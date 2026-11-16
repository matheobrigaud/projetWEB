# pip install pandas sqlalchemy pymysql
import pandas as pd
from sqlalchemy import create_engine, text

# ============================================================
# 1. PARAMÈTRES MYSQL (à modifier)
# ============================================================
UTILISATEUR = 'root'
MOT_DE_PASSE = ''
HOTE = '127.0.0.1'
PORT = 3306
BASE = 'cybersecurity'

# Fichier CSV -> nom de la table MySQL
FICHIERS = {
    'cybersecurity_attacks.csv': 'attaques',
    'Global_Cybersecurity_Threats_2015-2024.csv': 'menaces_globales',
    'baseFinale.csv': 'base_finale',
}

# ============================================================
# 2. CRÉATION DE LA BASE DE DONNÉES
# ============================================================
moteur_serveur = create_engine(f'mysql+pymysql://{UTILISATEUR}:{MOT_DE_PASSE}@{HOTE}:{PORT}')
with moteur_serveur.begin() as connexion:
    connexion.execute(text(f'CREATE DATABASE IF NOT EXISTS {BASE} CHARACTER SET utf8mb4'))

# Connexion à la base qu'on vient de créer
moteur = create_engine(f'mysql+pymysql://{UTILISATEUR}:{MOT_DE_PASSE}@{HOTE}:{PORT}/{BASE}?charset=utf8mb4')

# ============================================================
# 3. IMPORT DE CHAQUE CSV
# ============================================================
for fichier, table in FICHIERS.items():
    premier_bloc = True
    # On lit par blocs de 50 000 lignes pour ne pas saturer la mémoire
    for bloc in pd.read_csv(fichier, chunksize=50_000):
        # Noms de colonnes simples : "Source IP Address" -> "Source_IP_Address"
        bloc.columns = (bloc.columns.str.replace(r'[^0-9a-zA-Z]+', '_', regex=True)
                                    .str.strip('_'))
        bloc.to_sql(table, moteur,
                    if_exists='replace' if premier_bloc else 'append',  # 1er bloc : crée la table
                    index=False)
        premier_bloc = False
    print('Importé :', fichier, '->', table)

print('Terminé !')