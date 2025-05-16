#!/bin/bash

# MAWBoard Interactive Auto Installer
# For Debian/Ubuntu systems

set -e

REPO_URL="https://github.com/sergentd/mawboard.git"
WEB_ROOT="/var/www/html/mawboard"
CONFIG_PHP_PATH="api/db_config.php"

echo "==== MAWBoard Setup Script ===="

echo "===> Installing dependencies..."
sudo apt update
sudo apt install -y apache2 php php7.4-mysql php-curl php-gd php-intl php-json unzip git mariadb-client acl

# Step 1: Clone or update repo
echo "===> Cloning MAWBoard repository..."
sudo git config --global --add safe.directory "$WEB_ROOT"
if [ -d "$WEB_ROOT" ]; then
    echo "Updating existing MAWBoard directory at $WEB_ROOT ..."
    cd "$WEB_ROOT"
    git pull
else
    echo "Cloning MAWBoard repo to $WEB_ROOT ..."
    git clone "$REPO_URL" "$WEB_ROOT"
    sudo chown -R www-data:www-data mawboard
fi
cd "$WEB_ROOT"

echo "===> Setting up Apache virtual host..."
sudo cp /etc/apache2/sites-available/000-default.conf /etc/apache2/sites-available/000-default.conf.backup
sudo cp 000-default.conf /etc/apache2/sites-available/000-default.conf
sudo a2enmod rewrite
sudo systemctl restart apache2

read -t 30 -p "Do you want to configure MAWBoard now? [y/N] " configure
configure=${configure:-n}

if [[ "$configure" =~ ^[Yy]$ ]]; then
    CONFIG_FILE="$WEB_ROOT/$CONFIG_PHP_PATH"
    echo "===> Configuring MAWBoard $CONFIG_FILE..."

    read -p "Enter MySQL host (default: localhost): " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    read -p "Enter MySQL database name: " DB_NAME
    read -p "Enter MySQL user: " DB_USER
    read -s -p "Enter MySQL password: " DB_PASS
    echo
    read -p "Enter MySQL port (default: 3306): " DB_PORT
    DB_PORT=${DB_PORT:-3306}
    read -p "Enter OpenWeatherMap API Key: " WEATHER_API_KEY
    echo
    read -p "Enter AD_IMAGE_BASE_DIR (e.g. /home/mawuser/data/images/pubClient/): " IMGDIR
    IMGDIR=${IMGDIR:-/home/fitness/perlsoap/images/pubClient/}
    read -p "Enter AD_INI_FILE_PATH (e.g. /home/mawuser/conf/pubclient.ini): " INIPATH
    INIPATH=${INIPATH:-/home/fitness/perlsoap/conf/pubclient.ini}

    sudo sed -i "s|\(define('DB_HOST',\s*\).*);|\1'$DB_HOST');|" "$CONFIG_FILE"
    sudo sed -i "s|\(define('DB_USER',\s*\).*);|\1'$DB_USER');|" "$CONFIG_FILE"
    sudo sed -i "s|\(define('DB_PASS',\s*\).*);|\1'$DB_PASS');|" "$CONFIG_FILE"
    sudo sed -i "s|\(define('DB_NAME',\s*\).*);|\1'$DB_NAME');|" "$CONFIG_FILE"
    sudo sed -i "s|\(define('DB_PORT',\s*\).*);|\1$DB_PORT);" "$CONFIG_FILE"
    sudo sed -i "s|\(define('WEATHER_API_KEY',\s*\).*);|\1'$WEATHER_API_KEY');|" "$CONFIG_FILE"
    sudo sed -i "s|\(define('AD_IMAGE_BASE_DIR',\s*\).*);|\1'$IMGDIR');|" "$CONFIG_FILE"
    sudo sed -i "s|\(define('AD_INI_FILE_PATH',\s*\).*);|\1'$INIPATH');|" "$CONFIG_FILE"
else
    echo "===> Configuration skipped. You can manually edit: $CONFIG_FILE"
fi

echo "===> Setting permissions for $WEB_ROOT..."
sudo find "$WEB_ROOT" -type d -exec chmod 755 {} \;
sudo find "$WEB_ROOT" -type f -exec chmod 644 {} \;

echo "===> MAWBoard installation complete!"
echo "Visit: http://<your-server-ip>/ to begin."
