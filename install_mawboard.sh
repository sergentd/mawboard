#!/bin/bash

# MAWBoard Interactive Auto Installer
# For Debian/Ubuntu systems

set -e # Exit immediately if a command exits with a non-zero status.

REPO_URL="https://github.com/sergentd/mawboard.git"
WEB_ROOT="/var/www/html/mawboard"
IMGDIR="/home/fitness/perlsoap/images/pubClient/"
INIPATH="/home/fitness/perlsoap/conf/pubclient.ini"

echo "==== MAWBoard Setup Script ===="
if [ $# -lt 6 ]; then
    echo "Usage: $0 DB_HOST DB_NAME DB_USER DB_PASS DB_PORT WEATHER_API_KEY"
    exit 1
fi

echo "[INFO] Installing dependencies..."
sudo apt update
# Attention: Si le DNS échoue ici, les installations suivantes échoueront.
sudo apt install -y apache2 php php7.4-mysqli php-curl php-gd php-intl php-json unzip git mariadb-client acl

# Step 1: Manage MAWBoard repository directory
echo "[INFO] Setting up MAWBoard repository..."

# Ajouter le répertoire WEB_ROOT aux exceptions de sécurité Git pour l'utilisateur actuel (ou root si script est sudo'ed)
# Cela évite l'erreur "dubious ownership"
echo "[INFO] Adding $WEB_ROOT to git safe directories..."
sudo git config --global --add safe.directory "$WEB_ROOT"

if [ -d "$WEB_ROOT" ]; then
    echo "[INFO] Existing MAWBoard directory found at $WEB_ROOT."
    echo "[INFO] Removing existing directory to perform a fresh clone..."
    sudo rm -rf "$WEB_ROOT"
    echo "[INFO] Directory $WEB_ROOT removed successfully."
fi

# Dans tous les cas (qu'il existait et a été supprimé, ou qu'il n'existait pas), on clone.
echo "Cloning MAWBoard repo to $WEB_ROOT ..."
# Clone en tant que l'utilisateur actuel. Le chown viendra plus tard si nécessaire.
git clone "$REPO_URL" "$WEB_ROOT"
echo "[SUCCESS] Repository cloned successfully."
cd "$WEB_ROOT"

# Step 2: Apache Configuration
# Cette partie suppose que le fichier 000-default.conf se trouve à la racine du dépôt cloné.
APACHE_CONFIG_SOURCE_IN_REPO="000-default.conf" # Nom du fichier dans le dépôt
APACHE_CONFIG_DEST="/etc/apache2/sites-available/000-default.conf" # Nom du fichier de destination

# Si le fichier de config existe
if [ -f "$APACHE_CONFIG_SOURCE_IN_REPO" ]; then
    echo "[INFO] Setting up Apache virtual host using $APACHE_CONFIG_SOURCE_IN_REPO from repository..."
    # Optionnel : Sauvegarder la configuration Apache existante
    if [ -f "$APACHE_CONFIG_DEST" ]; then
        sudo cp "$APACHE_CONFIG_DEST" "${APACHE_CONFIG_DEST}.bak_$(date +%F_%T)"
        echo "[INFO] Backed up existing Apache config to ${APACHE_CONFIG_DEST}.bak_$(date +%F_%T)"
    fi
    sudo cp "$APACHE_CONFIG_SOURCE_IN_REPO" "$APACHE_CONFIG_DEST"
    echo "[SUCCESS] Apache virtual host configuration updated."
else
    echo "[WARN] Warning: Apache configuration file '$APACHE_CONFIG_SOURCE_IN_REPO' not found in the repository root."
    echo "[WARN] Skipping Apache vhost copy. Please ensure Apache is configured manually to point DocumentRoot to $WEB_ROOT."
fi

echo "[INFO] Enabling Apache modules and restarting Apache..."
sudo a2enmod rewrite
sudo systemctl restart apache2
echo "[INFO] Apache restarted."

# Step 3: Configure db_config.php
CONFIG_PHP_PATH="api/db_config.php" # Relatif à $WEB_ROOT
CONFIG_FILE_EXAMPLE="$WEB_ROOT/api/db_config.php.example"
CONFIG_FILE_TARGET="$WEB_ROOT/$CONFIG_PHP_PATH" # C'est ici que le fichier final doit être

if [ ! -f "$CONFIG_FILE_TARGET" ] && [ -f "$CONFIG_FILE_EXAMPLE" ]; then
    echo "[INFO] Found example config. Copying $CONFIG_FILE_EXAMPLE to $CONFIG_FILE_TARGET"
    sudo cp "$CONFIG_FILE_EXAMPLE" "$CONFIG_FILE_TARGET"
elif [ ! -f "$CONFIG_FILE_TARGET" ] && [ ! -f "$CONFIG_FILE_EXAMPLE" ]; then
    echo "[ERROR] Error: Neither $CONFIG_FILE_TARGET nor $CONFIG_FILE_EXAMPLE found after clone."
    echo "[ERROR] The repository needs to provide a template or the base db_config.php file."
fi

if [ ! -f "$CONFIG_FILE_TARGET" ]; then
	echo "[ERROR]: Configuration file $CONFIG_FILE_TARGET does not exist. Cannot configure."
else
	echo "[INFO] Configuring MAWBoard $CONFIG_FILE_TARGET..."

	# Fonction d’échappement sed
	escape_sed() {
		echo "$1" | sed -e 's/[\/&]/\\&/g'
	}

	# Remplacements
	DB_HOST_SED=$(escape_sed "$1")
	sed -i "s|\(define('DB_HOST',\s*\).*);|\1'$DB_HOST_SED');|" "$CONFIG_FILE_TARGET"
	echo "DB_HOST set"

	DB_NAME_SED=$(escape_sed "$2")
	sed -i "s|\(define('DB_NAME',\s*\).*);|\1'$DB_NAME_SED');|" "$CONFIG_FILE_TARGET"
	echo "[INFO] DB_NAME set"

	DB_USER_SED=$(escape_sed "$3")
	sed -i "s|\(define('DB_USER',\s*\).*);|\1'$DB_USER_SED');|" "$CONFIG_FILE_TARGET"
	echo "[INFO] DB_USER set"

	DB_PASS_SED=$(escape_sed "$4")
	sed -i "s|\(define('DB_PASS',\s*\).*);|\1'$DB_PASS_SED');|" "$CONFIG_FILE_TARGET"
	echo "[INFO] DB_PASS set"

	sed -i "s|\(define('DB_PORT',\s*\).*);|\1$5);|" "$CONFIG_FILE_TARGET"
	echo "[INFO] DB_PORT set"

	WEATHER_API_KEY_SED=$(escape_sed "$6")
	sed -i "s|\(define('WEATHER_API_KEY',\s*\).*);|\1'$WEATHER_API_KEY_SED');|" "$CONFIG_FILE_TARGET"
	echo "[INFO] WEATHER_API_KEY set"

	IMGDIR_SED=$(escape_sed "$IMGDIR")
	sed -i "s|\(define('AD_IMAGE_BASE_DIR',\s*\).*);|\1'$IMGDIR_SED');|" "$CONFIG_FILE_TARGET"
	echo "[INFO] AD_IMAGE_BASE_DIR set"

	INIPATH_SED=$(escape_sed "$INIPATH")
	sed -i "s|\(define('AD_INI_FILE_PATH',\s*\).*);|\1'$INIPATH_SED');|" "$CONFIG_FILE_TARGET"
	echo "[INFO] AD_INI_FILE_PATH set"

	echo "[SUCCESS] Configuration applied to $CONFIG_FILE_TARGET"
fi

# Step 4: Final Permissions
echo "[INFO] Setting final ownership and permissions for $WEB_ROOT..."
# Change ownership to www-data so Apache can serve and potentially write (if app needs it)
sudo chown -R www-data:www-data "$WEB_ROOT"
# Set general secure permissions
sudo find "$WEB_ROOT" -type d -exec chmod 755 {} \; # rwxr-xr-x for directories
sudo find "$WEB_ROOT" -type f -exec chmod 644 {} \; # rw-r--r-- for files

echo "[SUCCESS] MAWBoard installation/update complete!"
echo "[INFO] Visit: http://<your-server-ip>/ to begin. )."
echo "[INFO] DocumentRoot: $WEB_ROOT"