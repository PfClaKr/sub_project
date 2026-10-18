import Link from "next/link";
import { HOST, LEGAL_VERSION, MIN_AGE, NOTIFICATION_RETENTION, OPERATOR, RECORD_RETENTION, legalDate } from "@/libs/legal";
import { Fill } from "./LegalShell";

// Politique de confidentialité (français). Same facts as PrivacyKo.
export function PrivacyFr() {
	const op = <Fill value={OPERATOR.name} lang="fr" label="Nom de l'éditeur" />;
	const email = <Fill value={OPERATOR.email} lang="fr" label="E-mail de contact" />;
	const keep = RECORD_RETENTION.fr;
	return (
		<>
			<p>
				Cette politique explique comment {op} (l&apos;« Éditeur »), responsable de traitement, traite les données personnelles des utilisateurs du service itnyang
				(le « Service »), conformément au Règlement général sur la protection des données (RGPD) et à la loi Informatique et Libertés.
			</p>

			<h2 id="1">1. Données traitées, finalités et bases légales</h2>
			<div className="table-wrap">
				<table>
					<thead>
						<tr><th>Contexte</th><th>Données</th><th>Finalité</th><th>Base légale</th></tr>
					</thead>
					<tbody>
						<tr><td>Inscription et connexion (obligatoire)</td><td>E-mail, mot de passe (stocké sous forme hachée), pseudonyme, ville de résidence, langue de l&apos;interface (pour envoyer e-mails et notifications dans la même langue)</td><td>Création et gestion du compte, authentification, prévention des abus</td><td>Exécution du contrat</td></tr>
						<tr><td>Profil (facultatif)</td><td>Précision de lieu, photo de profil</td><td>Affichage du profil</td><td>Exécution du contrat</td></tr>
						<tr><td>Connexion avec Google (facultatif)</td><td>E-mail, nom (utilisé comme pseudonyme) et adresse de la photo du compte Google</td><td>Inscription et connexion</td><td>Exécution du contrat</td></tr>
						<tr><td>Utilisation du Service</td><td>Annonces, publications, commentaires et photos, lieu de transaction (quartier, ou point précis si le membre le choisit), messages, favoris, « j&apos;aime », enregistrements, signalements, blocages, notifications et préférences</td><td>Fourniture du Service</td><td>Exécution du contrat</td></tr>
						<tr><td>Coordonnées d&apos;une offre d&apos;emploi (facultatif)</td><td>Téléphone, e-mail</td><td>Affichées aux membres connectés qui cliquent sur « Voir le contact » (nombre de consultations enregistré)</td><td>Exécution du contrat</td></tr>
						<tr><td>E-mails de notification</td><td>E-mail</td><td>Envoi des notifications (désactivables dans les réglages ou via le lien de désinscription)</td><td>Exécution du contrat</td></tr>
						<tr><td>Notifications push (facultatif)</td><td>Adresse de réception push et clés de chiffrement de l&apos;appareil</td><td>Notifications sur le téléphone ou le navigateur</td><td>Consentement (activable et désactivable dans les réglages)</td></tr>
						<tr><td>Signalements et sanctions</td><td>Contenu du signalement, contenu ou conversation visés, suspensions</td><td>Lutte contre la fraude et le harcèlement, sécurité du Service</td><td>Intérêt légitime, obligation légale</td></tr>
						<tr><td>Données techniques</td><td>Adresse IP, journaux d&apos;erreurs</td><td>Limitation des tentatives de connexion et de réinitialisation, résolution d&apos;incidents</td><td>Intérêt légitime</td></tr>
					</tbody>
				</table>
			</div>
			<p>
				L&apos;adresse IP n&apos;est utilisée qu&apos;en mémoire pour compter les tentatives et n&apos;est pas enregistrée (effacée après 15 minutes à une heure).
				Les journaux d&apos;erreurs peuvent contenir une adresse e-mail ; ils sont écrasés au-delà d&apos;environ 30 Mo par service.
				Aucune donnée n&apos;est utilisée à des fins publicitaires ou de profilage, ni vendue.
			</p>

			<h2 id="2">2. Durées de conservation et suppression du compte</h2>
			<ul>
				<li><strong>Compte</strong> : jusqu&apos;à sa suppression.</li>
				<li><strong>Supprimés immédiatement avec le compte</strong> : compte et identifiants, photo de profil, annonces d&apos;objets et leurs photos, favoris, « j&apos;aime », enregistrements, notifications, appareils push, blocages effectués par le membre.</li>
				<li><strong>Annonces de logement et d&apos;emploi</strong> : retirées dès la suppression du compte ou de l&apos;annonce, photos effacées immédiatement ; le texte est conservé {keep} pour le traitement des signalements et des litiges, puis supprimé.</li>
				<li><strong>Publications et commentaires de l&apos;espace communautaire</strong> : restent visibles sans indication de l&apos;auteur (affiché « Membre parti ») ; le membre peut les supprimer avant de partir. Une publication supprimée est effacée définitivement après {keep}.</li>
				<li><strong>Conversations et signalements</strong> : les conversations d&apos;un membre parti et les signalements qu&apos;il a faits ou reçus sont conservés {keep} après la suppression du compte (litiges, fraudes), puis supprimés automatiquement ; l&apos;autre membre garde accès à la conversation pendant cette durée.</li>
				<li><strong>Notifications</strong> : supprimées automatiquement après {NOTIFICATION_RETENTION.fr}.</li>
				<li><strong>Lien de réinitialisation du mot de passe</strong> : valable une heure, à usage unique.</li>
				<li>Les données peuvent être conservées plus longtemps lorsque la loi l&apos;impose.</li>
			</ul>

			<h2 id="3">3. Destinataires</h2>
			<p>
				Les données ne sont ni vendues ni communiquées à des tiers. Les informations rendues publiques par le membre (pseudonyme, contenus, coordonnées d&apos;une offre
				d&apos;emploi) sont visibles des autres utilisateurs. Les données peuvent être transmises aux autorités sur réquisition légale.
			</p>

			<h2 id="4">4. Sous-traitants et transferts hors de l&apos;Union européenne</h2>
			<p>Les données des membres sont hébergées en France (Paris).</p>
			<div className="table-wrap">
				<table>
					<thead>
						<tr><th>Destinataire (pays)</th><th>Données</th><th>Finalité</th><th>Conservation</th></tr>
					</thead>
					<tbody>
						<tr><td>{HOST.name} (Luxembourg ; serveurs {HOST.region})</td><td>Toutes les données de la section 1</td><td>Hébergement, base de données, stockage des photos, envoi des e-mails</td><td>Durées de la section 2</td></tr>
						<tr><td>OpenStreetMap Foundation (Royaume-Uni)</td><td>Adresse IP du navigateur lors de l&apos;affichage des cartes ; termes et coordonnées des recherches de lieu (transmis par le serveur, sans donnée de compte)</td><td>Affichage des cartes, recherche d&apos;adresses et de quartiers</td><td>Selon la politique de l&apos;OSMF</td></tr>
						<tr><td>Google LLC (États-Unis)</td><td>Données échangées lors de la connexion avec Google</td><td>Connexion avec Google (si choisie)</td><td>Selon la politique de Google</td></tr>
						<tr><td>Service push du navigateur (Google, Mozilla, Apple… selon le navigateur)</td><td>Adresse push de l&apos;appareil, titre et court extrait de la notification</td><td>Acheminement des notifications push (si activées)</td><td>Selon la politique de chaque service</td></tr>
					</tbody>
				</table>
			</div>
			<p>
				Les transferts hors de l&apos;Union européenne reposent sur les garanties prévues par le RGPD (décision d&apos;adéquation, clauses contractuelles types).
				Pour les éviter, inscrivez-vous par e-mail plutôt qu&apos;avec Google et n&apos;activez pas les notifications push ; les cartes restent nécessaires pour choisir et afficher un lieu.
			</p>

			<h2 id="5">5. Vos droits</h2>
			<p>
				Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité de vos données, du droit de retirer votre
				consentement à tout moment, et du droit de définir des directives relatives au sort de vos données après votre décès. Vous pouvez modifier votre
				pseudonyme et votre photo dans « Mon compte », supprimer vos contenus vous-même, désactiver les e-mails et notifications push dans les réglages et
				supprimer votre compte depuis « Mon compte ». Pour toute autre demande, écrivez à {email} ; une réponse vous est apportée dans un délai d&apos;un mois.
			</p>
			<p>
				Vous pouvez introduire une réclamation auprès de la CNIL : 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07,
				<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer"> www.cnil.fr</a>.
			</p>

			<h2 id="6">6. Mineurs</h2>
			<p>L&apos;inscription est réservée aux personnes d&apos;au moins {MIN_AGE} ans. Un compte créé par une personne plus jeune est supprimé dès que l&apos;Éditeur en a connaissance.</p>

			<h2 id="7">7. Sécurité</h2>
			<ul>
				<li>Mots de passe hachés avec bcrypt ; seuls des condensats des liens de réinitialisation sont conservés.</li>
				<li>Échanges chiffrés (HTTPS) ; cookie de session inaccessible aux scripts (HttpOnly).</li>
				<li>Nombre de tentatives de connexion et de réinitialisation limité.</li>
				<li>Accès aux serveurs restreint au strict nécessaire ; droits d&apos;administration vérifiés à chaque requête.</li>
			</ul>

			<h2 id="8">8. Cookies et stockage local</h2>
			<p>
				Le Service n&apos;utilise que deux cookies, dispensés de consentement : celui qui maintient la connexion (token, 24 heures) et, si vous choisissez la langue de l&apos;interface, celui qui retient ce choix (itnyang.locale, 1 an). Le filtre de région
				choisi et la liste d&apos;installation de l&apos;accueil (étapes cochées, liste masquée) sont enregistrés dans le stockage local du navigateur (localStorage), sans être envoyés au serveur, pour être retrouvés à la visite suivante. Aucun cookie publicitaire ou de mesure d&apos;audience n&apos;est utilisé.
			</p>

			<h2 id="9">9. Contact et modifications</h2>
			<p>
				Responsable des données : <Fill value={OPERATOR.privacyOfficer} lang="fr" label="Nom" /> — {email}.
				Toute modification de cette politique est annoncée au moins 7 jours avant son entrée en vigueur (30 jours pour une modification importante).
				Version {LEGAL_VERSION}, en vigueur au {legalDate("fr")}. Voir aussi les <Link href="/terms?lang=fr">conditions d&apos;utilisation</Link>.
			</p>
		</>
	);
}
