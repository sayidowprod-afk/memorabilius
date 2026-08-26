# Logos d'équipes monochromes

Ce dossier contient des logos d'équipes dessinés exprès en **silhouette noire simple**
(pas les logos officiels détaillés — voir `src/components/TeamBadge.tsx` pour l'explication :
un écusson complet réduit en monochrome à 28px devient illisible, mais une icône simple
tracée exprès pour ça fonctionne très bien).

## Format attendu

- **PNG, fond transparent**
- Logo tracé en **noir uni** (`#000000`), pas de dégradé ni de couleurs
- Idéalement carré (ex. 128×128 ou 256×256), la silhouette centrée avec un peu de marge
- Le code applique `filter: invert(1)` automatiquement en mode sombre — pas besoin de
  fournir une version blanche séparée, le noir devient blanc tout seul

## Nommage

Un fichier par équipe, nommé `{sport}-{ABBR}.png` (remplace le `:` de l'id par un `-`).
Le sport et l'abréviation viennent de `src/lib/sportsTeams.ts` (colonne `id`).

Dépose les fichiers directement dans ce dossier (`public/team-logos-mono/`).
Une équipe sans fichier ici retombe automatiquement sur son logo couleur officiel —
tu peux donc en ajouter progressivement, pas besoin de tout faire d'un coup.

## Liste complète des fichiers attendus

<!-- Généré depuis src/lib/sportsTeams.ts — si de nouvelles équipes sont ajoutées côté
     code, régénère cette liste plutôt que de la corriger à la main. -->

## NBA

- `nba-ATL.png` — Atlanta Hawks
- `nba-BOS.png` — Boston Celtics
- `nba-BKN.png` — Brooklyn Nets
- `nba-CHA.png` — Charlotte Hornets
- `nba-CHI.png` — Chicago Bulls
- `nba-CLE.png` — Cleveland Cavaliers
- `nba-DAL.png` — Dallas Mavericks
- `nba-DEN.png` — Denver Nuggets
- `nba-DET.png` — Detroit Pistons
- `nba-GSW.png` — Golden State Warriors
- `nba-HOU.png` — Houston Rockets
- `nba-IND.png` — Indiana Pacers
- `nba-LAC.png` — LA Clippers
- `nba-LAL.png` — Los Angeles Lakers
- `nba-MEM.png` — Memphis Grizzlies
- `nba-MIA.png` — Miami Heat
- `nba-MIL.png` — Milwaukee Bucks
- `nba-MIN.png` — Minnesota Timberwolves
- `nba-NOP.png` — New Orleans Pelicans
- `nba-NYK.png` — New York Knicks
- `nba-OKC.png` — Oklahoma City Thunder
- `nba-ORL.png` — Orlando Magic
- `nba-PHI.png` — Philadelphia 76ers
- `nba-PHX.png` — Phoenix Suns
- `nba-POR.png` — Portland Trail Blazers
- `nba-SAC.png` — Sacramento Kings
- `nba-SAS.png` — San Antonio Spurs
- `nba-TOR.png` — Toronto Raptors
- `nba-UTA.png` — Utah Jazz
- `nba-WAS.png` — Washington Wizards

## WNBA

- `wnba-ATL.png` — Atlanta Dream
- `wnba-CHI.png` — Chicago Sky
- `wnba-CON.png` — Connecticut Sun
- `wnba-DAL.png` — Dallas Wings
- `wnba-GSV.png` — Golden State Valkyries
- `wnba-IND.png` — Indiana Fever
- `wnba-LVA.png` — Las Vegas Aces
- `wnba-LA.png` — Los Angeles Sparks
- `wnba-MIN.png` — Minnesota Lynx
- `wnba-NY.png` — New York Liberty
- `wnba-PHX.png` — Phoenix Mercury
- `wnba-SEA.png` — Seattle Storm
- `wnba-POR.png` — Portland Fire
- `wnba-TOR.png` — Toronto Tempo
- `wnba-WAS.png` — Washington Mystics

## NFL

- `nfl-ARI.png` — Arizona Cardinals
- `nfl-ATL.png` — Atlanta Falcons
- `nfl-BAL.png` — Baltimore Ravens
- `nfl-BUF.png` — Buffalo Bills
- `nfl-CAR.png` — Carolina Panthers
- `nfl-CHI.png` — Chicago Bears
- `nfl-CIN.png` — Cincinnati Bengals
- `nfl-CLE.png` — Cleveland Browns
- `nfl-DAL.png` — Dallas Cowboys
- `nfl-DEN.png` — Denver Broncos
- `nfl-DET.png` — Detroit Lions
- `nfl-GB.png` — Green Bay Packers
- `nfl-HOU.png` — Houston Texans
- `nfl-IND.png` — Indianapolis Colts
- `nfl-JAX.png` — Jacksonville Jaguars
- `nfl-KC.png` — Kansas City Chiefs
- `nfl-LAC.png` — Los Angeles Chargers
- `nfl-LAR.png` — Los Angeles Rams
- `nfl-LV.png` — Las Vegas Raiders
- `nfl-MIA.png` — Miami Dolphins
- `nfl-MIN.png` — Minnesota Vikings
- `nfl-NE.png` — New England Patriots
- `nfl-NO.png` — New Orleans Saints
- `nfl-NYG.png` — New York Giants
- `nfl-NYJ.png` — New York Jets
- `nfl-PHI.png` — Philadelphia Eagles
- `nfl-PIT.png` — Pittsburgh Steelers
- `nfl-SEA.png` — Seattle Seahawks
- `nfl-SF.png` — San Francisco 49ers
- `nfl-TB.png` — Tampa Bay Buccaneers
- `nfl-TEN.png` — Tennessee Titans
- `nfl-WSH.png` — Washington Commanders

## MLB

- `mlb-ARI.png` — Arizona Diamondbacks
- `mlb-ATL.png` — Atlanta Braves
- `mlb-BAL.png` — Baltimore Orioles
- `mlb-BOS.png` — Boston Red Sox
- `mlb-CHC.png` — Chicago Cubs
- `mlb-CWS.png` — Chicago White Sox
- `mlb-CIN.png` — Cincinnati Reds
- `mlb-CLE.png` — Cleveland Guardians
- `mlb-COL.png` — Colorado Rockies
- `mlb-DET.png` — Detroit Tigers
- `mlb-HOU.png` — Houston Astros
- `mlb-KC.png` — Kansas City Royals
- `mlb-LAA.png` — Los Angeles Angels
- `mlb-LAD.png` — Los Angeles Dodgers
- `mlb-MIA.png` — Miami Marlins
- `mlb-MIL.png` — Milwaukee Brewers
- `mlb-MIN.png` — Minnesota Twins
- `mlb-NYM.png` — New York Mets
- `mlb-NYY.png` — New York Yankees
- `mlb-OAK.png` — Athletics
- `mlb-PHI.png` — Philadelphia Phillies
- `mlb-PIT.png` — Pittsburgh Pirates
- `mlb-SD.png` — San Diego Padres
- `mlb-SEA.png` — Seattle Mariners
- `mlb-SF.png` — San Francisco Giants
- `mlb-STL.png` — St. Louis Cardinals
- `mlb-TB.png` — Tampa Bay Rays
- `mlb-TEX.png` — Texas Rangers
- `mlb-TOR.png` — Toronto Blue Jays
- `mlb-WSH.png` — Washington Nationals

## NHL

- `nhl-ANA.png` — Anaheim Ducks
- `nhl-BOS.png` — Boston Bruins
- `nhl-BUF.png` — Buffalo Sabres
- `nhl-CGY.png` — Calgary Flames
- `nhl-CAR.png` — Carolina Hurricanes
- `nhl-CHI.png` — Chicago Blackhawks
- `nhl-COL.png` — Colorado Avalanche
- `nhl-CBJ.png` — Columbus Blue Jackets
- `nhl-DAL.png` — Dallas Stars
- `nhl-DET.png` — Detroit Red Wings
- `nhl-EDM.png` — Edmonton Oilers
- `nhl-FLA.png` — Florida Panthers
- `nhl-LA.png` — Los Angeles Kings
- `nhl-MIN.png` — Minnesota Wild
- `nhl-MTL.png` — Montréal Canadiens
- `nhl-NSH.png` — Nashville Predators
- `nhl-NJ.png` — New Jersey Devils
- `nhl-NYI.png` — New York Islanders
- `nhl-NYR.png` — New York Rangers
- `nhl-OTT.png` — Ottawa Senators
- `nhl-PHI.png` — Philadelphia Flyers
- `nhl-PIT.png` — Pittsburgh Penguins
- `nhl-SJS.png` — San Jose Sharks
- `nhl-SEA.png` — Seattle Kraken
- `nhl-STL.png` — St. Louis Blues
- `nhl-TB.png` — Tampa Bay Lightning
- `nhl-TOR.png` — Toronto Maple Leafs
- `nhl-UTA.png` — Utah Hockey Club
- `nhl-VAN.png` — Vancouver Canucks
- `nhl-VGK.png` — Vegas Golden Knights
- `nhl-WSH.png` — Washington Capitals
- `nhl-WPG.png` — Winnipeg Jets

## FOOTBALL

- `football-ARS.png` — Arsenal
- `football-CHE.png` — Chelsea
- `football-LIV.png` — Liverpool
- `football-MCI.png` — Manchester City
- `football-MUN.png` — Manchester United
- `football-TOT.png` — Tottenham Hotspur
- `football-NEW.png` — Newcastle United
- `football-AVL.png` — Aston Villa
- `football-WHU.png` — West Ham United
- `football-BHA.png` — Brighton
- `football-BRE.png` — Brentford
- `football-FUL.png` — Fulham
- `football-CRY.png` — Crystal Palace
- `football-WOL.png` — Wolverhampton
- `football-EVE.png` — Everton
- `football-LEI.png` — Leicester City
- `football-IPS.png` — Ipswich Town
- `football-SOU.png` — Southampton
- `football-BOU.png` — Bournemouth
- `football-NFO.png` — Nottingham Forest
- `football-FCB.png` — Bayern Munich
- `football-BVB.png` — Borussia Dortmund
- `football-B04.png` — Bayer Leverkusen
- `football-RBL.png` — RB Leipzig
- `football-SGE.png` — Eintracht Frankfurt
- `football-VFB.png` — VfB Stuttgart
- `football-WOB.png` — Wolfsburg
- `football-HOF.png` — Hoffenheim
- `football-AUG.png` — Augsburg
- `football-SVW.png` — Werder Bremen
- `football-SCF.png` — SC Freiburg
- `football-FCU.png` — Union Berlin
- `football-M05.png` — Mainz 05
- `football-FCH.png` — Heidenheim
- `football-BOC.png` — VfL Bochum
- `football-STP.png` — St. Pauli
- `football-KSV.png` — Holstein Kiel
- `football-INT.png` — Inter Milan
- `football-ACM.png` — AC Milan
- `football-JUV.png` — Juventus
- `football-NAP.png` — Napoli
- `football-ROM.png` — AS Roma
- `football-LAZ.png` — Lazio
- `football-ATA.png` — Atalanta
- `football-FIO.png` — Fiorentina
- `football-BOL.png` — Bologna
- `football-TOR.png` — Torino
- `football-UDI.png` — Udinese
- `football-GEN.png` — Genoa
- `football-MON.png` — Monza
- `football-LEC.png` — Lecce
- `football-CAG.png` — Cagliari
- `football-EMP.png` — Empoli
- `football-VER.png` — Hellas Verona
- `football-COM.png` — Como
- `football-VEN.png` — Venezia
- `football-PAR.png` — Parma
- `football-RMA.png` — Real Madrid
- `football-BAR.png` — FC Barcelona
- `football-ATM.png` — Atlético Madrid
- `football-ATH.png` — Athletic Bilbao
- `football-RSO.png` — Real Sociedad
- `football-BET.png` — Real Betis
- `football-VIL.png` — Villarreal
- `football-VAL.png` — Valencia
- `football-SEV.png` — Sevilla
- `football-CEL.png` — Celta Vigo
- `football-GET.png` — Getafe
- `football-OSA.png` — Osasuna
- `football-RAY.png` — Rayo Vallecano
- `football-ESP.png` — Espanyol
- `football-MAL.png` — Mallorca
- `football-LPA.png` — Las Palmas
- `football-ALA.png` — Alavés
- `football-GIR.png` — Girona
- `football-LEG.png` — Leganés
- `football-VLL.png` — Real Valladolid
- `football-PSG.png` — Paris Saint-Germain
- `football-ASM.png` — Monaco
- `football-OLY.png` — Olympique Lyon
- `football-OM.png` — Olympique Marseille
- `football-RCL.png` — RC Lens
- `football-LOS.png` — Lille
- `football-OGC.png` — Nice
- `football-SRF.png` — Rennes
- `football-RCS.png` — Strasbourg
- `football-MPH.png` — Montpellier
- `football-SDR.png` — Reims
- `football-TFC.png` — Toulouse
- `football-SB29.png` — Stade Brest
- `football-HAC.png` — Le Havre
- `football-ASE.png` — Saint-Étienne
- `football-FCN.png` — Nantes
- `football-ANG.png` — Angers
- `football-AJA.png` — Auxerre
- `football-GDB.png` — Girondins de Bordeaux
