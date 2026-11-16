# pip install pandas sqlalchemy pymysql
import re
import pandas as pd
from sqlalchemy import create_engine, text

# ============================================================
# 1. PARAMÈTRES (à modifier)
# ============================================================
UTILISATEUR = 'root'
MOT_DE_PASSE = ''          # le même que dans phpMyAdmin
HOTE = '127.0.0.1'
PORT = 3306
BASE = 'cybersecurity'
FICHIER = 'fusion.csv'     # fichier créé par fusion_cyber.py
TABLE = 'fusion'

# ============================================================
# 2. CRÉATION DE LA BASE (supprime ce bloc si tu n'as pas le droit)
# ============================================================
moteur_serveur = create_engine(f'mysql+pymysql://{UTILISATEUR}:{MOT_DE_PASSE}@{HOTE}:{PORT}')
with moteur_serveur.begin() as connexion:
    connexion.execute(text(f'CREATE DATABASE IF NOT EXISTS {BASE} CHARACTER SET utf8mb4'))

moteur = create_engine(f'mysql+pymysql://{UTILISATEUR}:{MOT_DE_PASSE}@{HOTE}:{PORT}/{BASE}?charset=utf8mb4')

# ============================================================
# 3. LECTURE DU CSV
# ============================================================
# keep_default_na=False : sinon le code pays "NA" (Namibie) est lu comme une case vide
fusion = pd.read_csv(FICHIER, keep_default_na=False, na_values=[''])

# ============================================================
# 4. NOMS DE COLONNES COMPATIBLES MYSQL
# ============================================================
# Ex : "att_Attack Type=DDoS" -> "att_Attack_Type_DDoS"
# MySQL limite les noms à 64 caractères et ignore majuscules/minuscules,
# donc on évite aussi les doublons.
nouveaux_noms = []
deja_pris = set()
for nom in fusion.columns:
    propre = re.sub(r'[^0-9a-zA-Z]+', '_', nom).strip('_')[:60]
    final = propre
    numero = 2
    while final.lower() in deja_pris:      # doublon -> on ajoute un numéro
        final = f'{propre}_{numero}'
        numero += 1
    deja_pris.add(final.lower())
    nouveaux_noms.append(final)
fusion.columns = nouveaux_noms

# ============================================================
# 5. ENVOI DANS MYSQL
# ============================================================
# if_exists='replace' : la table est recréée à chaque lancement
fusion.to_sql(TABLE, moteur, if_exists='replace', index=False, chunksize=1000)
print('Terminé !', len(fusion), 'lignes importées dans', BASE + '.' + TABLE)