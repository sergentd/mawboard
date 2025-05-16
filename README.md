# MAWBoard - Écran d'Accueil et d'Information

MAWBoard est une application web conçue pour servir d'écran d'accueil interactif, d'affichage d'informations pour les membres et de plateforme publicitaire, typiquement pour un club de fitness ou un établissement similaire. Elle interroge une base de données backend pour les événements de scan des membres et affiche les informations pertinentes ou une liste des scans récents.

## Fonctionnalités

*   **Écran de Veille (Idle Screen):**
    *   Affiche un message de bienvenue et une invite à scanner une carte.
    *   Indique les informations météorologiques actuelles pour un lieu configurable.
    *   Affiche la date et l'heure actuelles.
    *   Diffuse un cycle de publicités (images, vidéos, PDF) lues à partir d'un fichier de configuration INI externe. Les publicités sont affichées en superposition.
*   **Affichage Scan Membre:**
    *   Lorsqu'un scan de membre est détecté, affiche temporairement des informations spécifiques au membre :
        *   Message de bienvenue avec le nom du membre.
        *   Messages/alertes personnalisés (peuvent inclure des icônes extraites de la chaîne de message).
        *   Statistiques clés (par ex., jours depuis la dernière mesure, sessions restantes, nombre d'entraînements).
        *   Indicateur visuel de statut (par ex., vert pour autorisé, orange pour avertissement, rouge pour refusé).
    *   Retourne automatiquement à l'écran de veille après un délai configurable.
*   **Mode Liste:**
    *   Vue alternative affichant une liste des scans récents des membres (6 dernières heures).
    *   Chaque élément de la liste indique le nom du membre, l'heure du scan et un indicateur de statut.
    *   Les messages/alertes avec icônes sont également affichés pour chaque scan dans la liste.
*   **Panneau des Paramètres:**
    *   Changer la langue d'affichage (EN, FR, DE, IT, PT supportées via des fichiers de traduction JSON).
    *   Définir la ville et le pays pour les informations météorologiques.
    *   Activer/Désactiver les publicités.
    *   Définir/Modifier/Supprimer un mot de passe pour verrouiller le bouton de basculement de mode (Veille/Liste) afin d'éviter les changements accidentels.
*   **Contenu Dynamique:**
    *   Météo, date, heure, citations (depuis JSON) et publicités sont mis à jour dynamiquement.
    *   Les informations de scan des membres sont récupérées via une API backend.

## Technologies Utilisées

*   **Frontend:** HTML, CSS, JavaScript (Modules ES6)
*   **API Backend:** PHP (pour l'interaction avec la base de données, l'analyse de fichiers INI, proxy d'images)
*   **Base de données:** MySQL (attendue pour stocker les statistiques des membres et des scans)
*   **Configuration Externe:** Les publicités sont configurées via un fichier INI.

## Déploiement (Manuel - Apache sur Linux)

Ce guide suppose que vous disposez d'un serveur web Apache avec PHP (incluant les extensions `mysqli`, `curl`, `gd`, `intl`, `json`) et d'une base de données MySQL déjà configurés sur votre machine Linux cible (par exemple, un Raspberry Pi).

**1. Préparer le Serveur:**
   *   Assurez-vous qu'Apache, PHP (recommandé PHP 7.4+ ou 8.0+) et MySQL sont installés et en cours d'exécution.
   *   Vérifiez que les extensions PHP nécessaires sont activées (via `php.ini`).
   *   Assurez-vous que les tables requises existent dasns MySQL (`Statistique`, `synchronisation`). Importez votre schéma si vous en avez un.
   *   Créez un utilisateur MySQL avec les permissions appropriées (SELECT) pour l'application sur votre base de données.

**2. Copier les Fichiers de l'Application:**
   *   Transférez l'intégralité du répertoire du projet (par ex., `MAWxBoard/`) sur votre serveur. Un emplacement courant pour les fichiers web est `/var/www/html/`. Supposons que vous le placiez dans `/var/www/html/mawboard/`.
     La structure devrait être :
  ```
  /var/www/html/mawboard/
  ├── api/
  ├── lang/
  ├── static/
  ├── 000-default.conf
  └── index.html
  ```

**3. Configurer `db_config.php`:**
   *   Naviguez vers `/var/www/html/mawboard/api/`.
   *   Modifiez `db_config.php`.
   *  * Mettez à jour les constantes suivantes avec les détails réels de votre serveur et de votre base de données :
      *   `DB_HOST`: (par ex., `'localhost'` si MySQL est sur le même serveur)
      *   `DB_USER`: Votre utilisateur MySQL pour l'application
      *   `DB_PASS`: Mot de passe de l'utilisateur MySQL
      *   `DB_NAME`: Nom de votre base de données
      *   `DB_PORT`: (par ex., `3306`)
      *   `WEATHER_API_KEY`: Votre clé API OpenWeatherMap.
      *   `AD_INI_FILE_PATH_ACTUAL`: Le **chemin absolu du système de fichiers** vers votre fichier `pubclient.ini` (par ex., `'/home/mawuser/conf/pubclient.ini'`).
      *   `AD_IMAGE_BASE_DIR_ACTUAL`: Le **chemin absolu du système de fichiers** vers le répertoire où sont stockées les images publicitaires (par ex., `'/home/mawuser/data/images/pubclient/'`).
   *   Assurez-vous que `date.timezone` de PHP est correctement configuré dans le `php.ini` de votre serveur (par ex., `date.timezone = "Europe/Paris"`) pour correspondre au fuseau horaire des données écrites dans la base de données, en particulier pour `LastUpdate`, `DateEntree`, `HeureEntree`.

**4. Configurer Apache:**
   *   Vous devez indiquer à Apache de servir votre application à partir du sous-répertoire `mawboard`. Il est souvent préférable d'en faire le `DocumentRoot` pour un hôte virtuel spécifique ou pour le site par défaut si c'est la seule application.
   *   **Localisez la configuration du site Apache :** Habituellement dans `/etc/apache2/sites-available/`. Le fichier par défaut est souvent `000-default.conf`.
   *   **Sauvegardez la configuration existante :**
  ```bash
  sudo mv /etc/apache2/sites-available/000-default.conf /etc/apache2/sites-available/000-default.conf.backup
  sudo cp /var/www/html/mawboard/000-default.conf /etc/apache2/sites-available/000-default.conf
  ```
   *   **Modifiez `000-default.conf` (ou créez-en un nouveau) :**
  ```apache
  <VirtualHost *:80>
      ServerAdmin webmaster@localhost
      DocumentRoot /var/www/html/mawboard  # <<< FAITES POINTER CECI VERS LA RACINE DE VOTRE APP

      ErrorLog ${APACHE_LOG_DIR}/error.log
      CustomLog ${APACHE_LOG_DIR}/access.log combined

      <Directory /var/www/html/mawboard>
          Options Indexes FollowSymLinks
          AllowOverride All # Permet les .htaccess si vous prévoyez de les utiliser
                            # Mettre à None si non utilisé pour de meilleures perfs/sécurité
          Require all granted
      </Directory>
  </VirtualHost>
  ```
   *   **Activez les modules Apache nécessaires (si ce n'est pas déjà fait) :**
  ```bash
  sudo a2enmod rewrite # Si vous utilisez AllowOverride All et .htaccess pour la réécriture
  ```
   *   **Redémarrez Apache :**
  ```bash
  sudo systemctl restart apache2
  ```

**5. Définir les Permissions des Fichiers:**
   *   L'utilisateur du serveur web (par ex., `www-data` sur Debian/Ubuntu) a besoin d'un accès en lecture à tous les fichiers de l'application.
   *   Il a également besoin d'un accès en lecture à `AD_INI_FILE_PATH_ACTUAL` et `AD_IMAGE_BASE_DIR_ACTUAL` (et des permissions d'exécution sur les répertoires parents pour y accéder).
  ```bash
  sudo chown -R www-data:www-data /var/www/html/mawboard
  sudo find /var/www/html/mawboard -type d -exec chmod 755 {} \;
  sudo find /var/www/html/mawboard -type f -exec chmod 644 {} \;

  # Pour les chemins externes des publicités, assurez-vous que www-data peut lire :
  # Exemple (ajustez les chemins et utilisateurs/groupes si besoin) :
  sudo setfacl -R -m u:www-data:rX /home/mawuser/conf/
  sudo setfacl -R -m u:www-data:rX /home/mawuser/data/images/
  # Ou ajoutez www-data à un groupe qui a accès, ou changez le propriétaire (moins idéal pour les répertoires partagés).
  ```

**6. Accéder à l'Application:**
   Ouvrez un navigateur web et naviguez vers l'adresse IP ou le nom d'hôte de votre serveur (par ex., `http://<votre_ip_serveur>/`).

## Utilisation

**Écrans Principaux :**

*   **Écran de Veille (Idle Screen) :** Vue par défaut. Affiche le message de bienvenue, l'invite de scan, la météo, l'heure et les publicités.
*   **Mode Liste (List Screen) :** Affiche une liste des scans récents. Accessible via le bouton de basculement dans l'en-tête.
*   **Écran Membre (Member Screen) :** Apparaît automatiquement après un scan réussi en mode Veille. Affiche les détails et statistiques du membre. Disparaît après un délai.

**Panneau des Paramètres :**

*   Accessible via l'icône d'engrenage (⚙️) dans l'en-tête.
*   **Langue :** Sélectionnez la langue d'affichage.
*   **Localisation Météo :** Spécifiez la Ville et le Pays (code à 2 lettres) pour les données météorologiques.
*   **Afficher Publicités :** Activez/désactivez les publicités pour l'écran de veille.
*   **Verrouillage Écran (Mot de passe) :**
    *   Entrez un mot de passe pour verrouiller le basculement de mode Veille/Liste.
    *   Si un mot de passe est défini, le bouton "Retirer le Mot de Passe" apparaît. Cliquer dessus demandera le mot de passe actuel avant de supprimer le verrou.
    *   Pour changer un mot de passe existant, entrez le nouveau mot de passe désiré dans le champ. Il vous sera demandé le mot de passe actuel pour confirmer le changement.
*   **Enregistrer/Fermer :** Utilisez les boutons en bas du panneau. "Enregistrer" applique les paramètres. "Fermer" quitte. Les changements de langue tentent une mise à jour dynamique.

**Bouton de Basculement de Mode :**

*   Situé sous l'en-tête.
*   Bascule entre "Écran de Veille" et "Mode Liste".
*   Si un verrou par mot de passe est activé, il demandera le mot de passe avant de basculer.
*   Une inactivité de 10 secondes sur la demande de mot de passe fermera la fenêtre de saisie.

## Dépannage

*   **403 Interdit (Forbidden) :** Vérifiez le `DocumentRoot` d'Apache, les permissions `<Directory>` dans la configuration Apache, et les permissions du système de fichiers pour `/var/www/html/mawboard`. Consultez les logs d'erreur Apache (`/var/log/apache2/error.log`).
*   **Paramètres non sauvegardés :** Vérifiez la console du navigateur pour des erreurs JavaScript. Vérifiez les clés `localStorage` dans `static/js/config.js` et leur utilisation dans `static/js/stateService.js`.
*   **Publicités/Images non chargées :**
    *   Vérifiez que `AD_INI_FILE_PATH_ACTUAL` dans `api/db_config.php` est correct.
    *   Vérifiez que `AD_IMAGE_BASE_DIR_ACTUAL` dans `api/db_config.php` est correct.
    *   Assurez-vous que l'utilisateur du serveur web (`www-data`) a les permissions de lecture pour le fichier INI et le répertoire des images publicitaires et son contenu.
    *   Vérifiez la console du navigateur pour des erreurs 404 sur les chemins des images.
    *   Consultez les logs d'erreur PHP pour des problèmes dans `api/get_ads.php` ou `api/get_ad_image.php`.
*   **Erreurs PHP (500 Erreur Interne du Serveur) :** Consultez toujours le journal des erreurs PHP sur le serveur. Le chemin est généralement défini dans `php.ini` (par ex., `/var/log/php_errors.log` ou via le journal d'erreurs d'Apache).
