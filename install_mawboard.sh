#!/bin/bash

# MAWBoard Interactive Auto Installer
# For Debian/Ubuntu systems

set -e # Exit immediately if a command exits with a non-zero status.

REPO_URL="https://github.com/sergentd/mawboard.git"
WEB_ROOT="/var/www/html/mawboard"

echo "==== MAWBoard Setup Script ===="

echo "===> Installing dependencies..."
sudo apt update
# Attention: Si le DNS échoue ici, les installations suivantes échoueront.
sudo apt install -y apache2 php php-mysqli php-curl php-gd php-intl php-json unzip git mariadb-client acl

# Step 1: Manage MAWBoard repository directory
echo "===> Setting up MAWBoard repository..."

# Ajouter le répertoire WEB_ROOT aux exceptions de sécurité Git pour l'utilisateur actuel (ou root si script est sudo'ed)
# Cela évite l'erreur "dubious ownership"
echo "Adding $WEB_ROOT to git safe directories..."
sudo git config --global --add safe.directory "$WEB_ROOT"

if [ -d "$WEB_ROOT" ]; then
    echo "Existing MAWBoard directory found at $WEB_ROOT."
    echo "Removing existing directory to perform a fresh clone..."
    sudo rm -rf "$WEB_ROOT"
    if [ $? -eq 0 ]; then
        echo "Directory $WEB_ROOT removed successfully."
    else
        echo "Error: Failed to remove directory $WEB_ROOT. Please check permissions or if it's in use."
        exit 1
    fi
fi

# Dans tous les cas (qu'il existait et a été supprimé, ou qu'il n'existait pas), on clone.
echo "Cloning MAWBoard repo to $WEB_ROOT ..."
# Clone en tant que l'utilisateur actuel. Le chown viendra plus tard si nécessaire.
git clone "$REPO_URL" "$WEB_ROOT"
if [ $? -ne 0 ]; then
    echo "Error: Failed to clone repository from $REPO_URL to $WEB_ROOT."
    exit 1
fi

echo "Repository cloned successfully."
cd "$WEB_ROOT"

# Step 2: Apache Configuration
# Cette partie suppose que le fichier 000-default.conf se trouve à la racine du dépôt cloné.
APACHE_CONFIG_SOURCE_IN_REPO="000-default.conf" # Nom du fichier dans le dépôt
APACHE_CONFIG_DEST="/etc/apache2/sites-available/000-default.conf" # Nom du fichier de destination

# Si le fichier de config existe
if [ -f "$APACHE_CONFIG_SOURCE_IN_REPO" ]; then
    echo "===> Setting up Apache virtual host using $APACHE_CONFIG_SOURCE_IN_REPO from repository..."
    # Optionnel : Sauvegarder la configuration Apache existante
    if [ -f "$APACHE_CONFIG_DEST" ]; then
        sudo cp "$APACHE_CONFIG_DEST" "${APACHE_CONFIG_DEST}.bak_$(date +%F_%T)"
        echo "Backed up existing Apache config to ${APACHE_CONFIG_DEST}.bak_$(date +%F_%T)"
    fi
    sudo cp "$APACHE_CONFIG_SOURCE_IN_REPO" "$APACHE_CONFIG_DEST"
    echo "Apache virtual host configuration updated."
else
    echo "Warning: Apache configuration file '$APACHE_CONFIG_SOURCE_IN_REPO' not found in the repository root."
    echo "Skipping Apache vhost copy. Please ensure Apache is configured manually to point DocumentRoot to $WEB_ROOT."
fi

echo "===> Enabling Apache modules and restarting Apache..."
sudo a2enmod rewrite
sudo systemctl restart apache2
if [ $? -ne 0 ]; then
    echo "Error: Failed to restart Apache. Please check Apache configuration."
fi
echo "Apache restarted."

# Step 3: Configure db_config.php
CONFIG_PHP_PATH="api/db_config.php" # Relatif à $WEB_ROOT

# Il est préférable de copier un db_config.php.example vers db_config.php
# et ensuite d'utiliser sed sur db_config.php.
# Supposons que le dépôt contient api/db_config.php.example
CONFIG_FILE_EXAMPLE="$WEB_ROOT/api/db_config.php.example"
CONFIG_FILE_TARGET="$WEB_ROOT/$CONFIG_PHP_PATH" # C'est ici que le fichier final doit être

if [ ! -f "$CONFIG_FILE_TARGET" ] && [ -f "$CONFIG_FILE_EXAMPLE" ]; then
    echo "Found example config. Copying $CONFIG_FILE_EXAMPLE to $CONFIG_FILE_TARGET"
    sudo cp "$CONFIG_FILE_EXAMPLE" "$CONFIG_FILE_TARGET"
elif [ ! -f "$CONFIG_FILE_TARGET" ] && [ ! -f "$CONFIG_FILE_EXAMPLE" ]; then
    echo "Error: Neither $CONFIG_FILE_TARGET nor $CONFIG_FILE_EXAMPLE found after clone."
    echo "The repository needs to provide a template or the base db_config.php file."
fi

read -t 30 -p "Do you want to configure MAWBoard now (edit $CONFIG_PHP_PATH)? [y/N] " configure
configure=${configure:-n}

if [[ "$configure" =~ ^[Yy]$ ]]; then
    if [ ! -f "$CONFIG_FILE_TARGET" ]; then
        echo "Error: Configuration file $CONFIG_FILE_TARGET does not exist. Cannot configure."
    else
        echo "===> Configuring MAWBoard $CONFIG_FILE_TARGET..."
        read -p "Enter MySQL host (default: localhost): " DB_HOST
        DB_HOST=${DB_HOST:-localhost}
        # Échapper les valeurs pour sed si elles peuvent contenir des caractères spéciaux
        DB_HOST_SED=$(echo "$DB_HOST" | sed -e 's/[\/&]/\\&/g' -e "s/'/\\\'/g")

        sudo sed -i "s|\(define('DB_HOST',\s*\).*);|\1'$DB_HOST_SED');|" "$CONFIG_FILE_TARGET"
        echo "DB_HOST set"

        read -p "Enter MySQL database name: " DB_NAME
        DB_NAME_SED=$(echo "$DB_NAME" | sed -e 's/[\/&]/\\&/g' -e "s/'/\\\'/g")
        sudo sed -i "s|\(define('DB_NAME',\s*\).*);|\1'$DB_NAME_SED');|" "$CONFIG_FILE_TARGET"
        echo "DB_NAME set"

        read -p "Enter MySQL user: " DB_USER
        DB_USER_SED=$(echo "$DB_USER" | sed -e 's/[\/&]/\\&/g' -e "s/'/\\\'/g")
        sudo sed -i "s|\(define('DB_USER',\s*\).*);|\1'$DB_USER_SED');|" "$CONFIG_FILE_TARGET"
        echo "DB_USER set"

        read -s -p "Enter MySQL password: " DB_PASS
        echo
        DB_PASS_SED=$(echo "$DB_PASS" | sed -e 's/[\/&]/\\&/g' -e "s/'/\\\'/g")
        sudo sed -i "s|\(define('DB_PASS',\s*\).*);|\1'$DB_PASS_SED');|" "$CONFIG_FILE_TARGET"
        echo "DB_PASS set"

        read -p "Enter MySQL port (default: 3306): " DB_PORT
        DB_PORT=${DB_PORT:-3306}
        sudo sed -i "s|\(define('DB_PORT',\s*\).*);|\1$DB_PORT);|" "$CONFIG_FILE_TARGET"
        echo "DB_PORT set"

        read -p "Enter OpenWeatherMap API Key: " WEATHER_API_KEY
        echo
        WEATHER_API_KEY_SED=$(echo "$WEATHER_API_KEY" | sed -e 's/[\/&]/\\&/g' -e "s/'/\\\'/g")
        sudo sed -i "s|\(define('WEATHER_API_KEY',\s*\).*);|\1'$WEATHER_API_KEY_SED');|" "$CONFIG_FILE_TARGET"
        echo "WEATHER_API_KEY set"

        read -p "Enter AD_IMAGE_BASE_DIR (e.g. /home/mawuser/data/images/pubClient/): " IMGDIR
        IMGDIR=${IMGDIR:-/home/fitness/perlsoap/images/pubClient/}
        IMGDIR_SED=$(echo "$IMGDIR" | sed -e 's/[\/&]/\\&/g' -e "s/'/\\\'/g")
        sudo sed -i "s|\(define('AD_IMAGE_BASE_DIR',\s*\).*);|\1'$IMGDIR_SED');|" "$CONFIG_FILE_TARGET"
        echo "AD_IMAGE_BASE_DIR set"

        read -p "Enter AD_INI_FILE_PATH (e.g. /home/mawuser/conf/pubclient.ini): " INIPATH
        INIPATH=${INIPATH:-/home/fitness/perlsoap/conf/pubclient.ini}
        INIPATH_SED=$(echo "$INIPATH" | sed -e 's/[\/&]/\\&/g' -e "s/'/\\\'/g")
        sudo sed -i "s|\(define('AD_INI_FILE_PATH',\s*\).*);|\1'$INIPATH_SED');|" "$CONFIG_FILE_TARGET"
        echo "AD_INI_FILE_PATH set"

        echo "Configuration applied to $CONFIG_FILE_TARGET"
    fi
else
    echo "===> Configuration skipped. You can manually edit: $CONFIG_FILE_TARGET"
    echo "Ensure the file contains the correct database and API credentials."
fi

# Step 4: Final Permissions
echo "===> Setting final ownership and permissions for $WEB_ROOT..."
# Change ownership to www-data so Apache can serve and potentially write (if app needs it)
sudo chown -R www-data:www-data "$WEB_ROOT"
# Set general secure permissions
sudo find "$WEB_ROOT" -type d -exec chmod 755 {} \; # rwxr-xr-x for directories
sudo find "$WEB_ROOT" -type f -exec chmod 644 {} \; # rw-r--r-- for files

echo "===> MAWBoard installation/update complete!"
echo "Visit: http://<your-server-ip>/ to begin (this path assumes your Apache DocumentRoot is $WEB_ROOT)."