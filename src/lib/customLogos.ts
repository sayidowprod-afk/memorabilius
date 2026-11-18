// Équipes pour lesquelles un logo maison existe dans public/team-logos/ (<sport>-<abréviation>.svg|png|webp).
// TeamBadge ne cherche un logo maison QUE pour ces identifiants : sans cette liste, chaque pastille d'équipe testait trois fichiers
// inexistants (svg, png, webp : 6 requêtes 404 avec l'image de fond) avant d'afficher le logo officiel.
// Pour ajouter un logo maison : déposer le fichier dans public/team-logos/ ET ajouter son identifiant ici (ex. 'nhl-MTL').
export const CUSTOM_LOGO_IDS = new Set<string>([])
