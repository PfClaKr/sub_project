import Link from "next/link";
import { LEGAL_VERSION, MIN_AGE, OPERATOR, legalDate } from "@/libs/legal";
import { Fill } from "./LegalShell";

// Conditions générales d'utilisation (français). Same content as TermsKo.
export function TermsFr() {
	const op = <Fill value={OPERATOR.name} lang="fr" label="Nom de l'éditeur" />;
	const contact = <Fill value={OPERATOR.email} lang="fr" label="E-mail de contact" />;
	return (
		<>
			<h2 id="1">Article 1 – Objet</h2>
			<p>
				Les présentes conditions générales d&apos;utilisation (les « CGU ») définissent les conditions d&apos;accès et d&apos;utilisation du service itnyang (잇냥),
				site web et application installable (le « Service »), édité par {op} (l&apos;« Éditeur »), ainsi que les droits et obligations de l&apos;Éditeur et des membres.
			</p>

			<h2 id="2">Article 2 – Définitions</h2>
			<ul>
				<li><strong>Service</strong> : petites annonces d&apos;objets d&apos;occasion, espace communautaire (forum libre, questions-réponses sur la vie en France), annonces de logement et d&apos;emploi, messagerie entre membres et notifications, destinés à la communauté coréenne en France.</li>
				<li><strong>Membre</strong> : toute personne ayant accepté les CGU et la politique de confidentialité et créé un compte.</li>
				<li><strong>Contenu</strong> : annonces, textes, photos, commentaires et messages publiés par un membre.</li>
			</ul>

			<h2 id="3">Article 3 – Accès aux CGU et modifications</h2>
			<p>
				Les CGU sont accessibles à tout moment par le lien « Conditions d&apos;utilisation » en bas de page. Toute modification est annoncée sur le Service ou par e-mail
				au moins 7 jours avant son entrée en vigueur, et au moins 30 jours avant si elle est défavorable aux membres. Le membre qui refuse les nouvelles CGU peut
				supprimer son compte ; à défaut, la poursuite de l&apos;utilisation après la date d&apos;entrée en vigueur vaut acceptation.
			</p>

			<h2 id="4">Article 4 – Inscription et compte</h2>
			<p>
				L&apos;inscription, par adresse e-mail vérifiée ou par compte Google, est réservée aux personnes âgées d&apos;au moins {MIN_AGE} ans. Le membre fournit des informations
				exactes, ne se fait pas passer pour un tiers et ne crée pas plusieurs comptes pour contourner une sanction. Il est responsable de la confidentialité de ses
				identifiants et prévient l&apos;Éditeur en cas d&apos;utilisation frauduleuse de son compte.
			</p>

			<h2 id="5">Article 5 – Rôle de l&apos;Éditeur et fonctionnement du Service</h2>
			<ul>
				<li>Le Service est gratuit. L&apos;Éditeur n&apos;encaisse aucun paiement et n&apos;intervient pas dans les transactions.</li>
				<li>
					L&apos;Éditeur n&apos;est pas partie aux transactions entre membres (vente d&apos;objets, location, emploi) et ne garantit ni les membres, ni les biens, logements ou
					offres d&apos;emploi. Les conditions et l&apos;exécution des transactions relèvent de la seule responsabilité des membres concernés.
				</li>
				<li>
					Les transactions entre particuliers ne bénéficient pas des règles protectrices applicables aux achats auprès d&apos;un professionnel (droit de rétractation
					notamment). Un membre agissant à titre professionnel l&apos;indique dans son annonce et respecte lui-même les obligations qui s&apos;imposent à lui.
				</li>
				<li>
					Critères de classement (article L. 111-7 du Code de la consommation) : par défaut, les annonces et publications sont affichées de la plus récente à la plus
					ancienne ; le membre peut trier par pertinence de recherche, prix, distance ou popularité (nombre de « j&apos;aime » et de commentaires, ancienneté). Les objets
					vendus apparaissent plus bas dans les résultats de recherche. Aucun classement n&apos;est rémunéré.
				</li>
				<li>Avant toute transaction, consultez le <Link href="/safety">guide de sécurité</Link> : n&apos;envoyez jamais d&apos;argent avant d&apos;avoir vu l&apos;objet ou le logement.</li>
			</ul>

			<h2 id="6">Article 6 – Comportements interdits</h2>
			<p>Il est interdit notamment :</p>
			<ul>
				<li>d&apos;escroquer, d&apos;exiger un paiement avant la visite ou la remise, de publier de fausses annonces ou de fausses offres d&apos;emploi ;</li>
				<li>de proposer des biens dont la vente est interdite ou réglementée (armes, stupéfiants, contrefaçons, médicaments, etc.) ;</li>
				<li>de publier des offres d&apos;emploi contraires à la loi (rémunération inférieure au SMIC, travail dissimulé, etc.) ;</li>
				<li>de publier les données personnelles ou l&apos;image d&apos;autrui sans son accord, ou d&apos;usurper une identité ;</li>
				<li>de tenir des propos injurieux, haineux, discriminatoires ou harcelants, ou de diffuser des contenus pornographiques ;</li>
				<li>de faire de la publicité non sollicitée, de publier en masse le même contenu, ou d&apos;attirer des membres vers une messagerie ou un paiement extérieurs pour leur nuire ;</li>
				<li>de porter atteinte aux droits de propriété intellectuelle d&apos;autrui ;</li>
				<li>de perturber le Service (extraction automatisée, contournement des mesures de sécurité, logiciels malveillants).</li>
			</ul>

			<h2 id="7">Article 7 – Contenus</h2>
			<p>
				Le membre conserve ses droits sur ses contenus. Il concède à l&apos;Éditeur, à titre gratuit et non exclusif, le droit de les afficher au sein du Service (listes,
				recherche, notifications) et de les reproduire ou redimensionner dans la mesure nécessaire à son fonctionnement, pour la durée de leur publication.
				Les publications et commentaires de l&apos;espace communautaire, liés aux réponses d&apos;autres membres, restent visibles après la suppression du compte sans
				indication de leur auteur (affiché « 탈퇴한 회원 », membre parti) ; le membre peut les supprimer lui-même avant de partir. Pour une publication anonyme, l&apos;Éditeur connaît
				l&apos;auteur et ne le consulte que pour traiter un signalement ou répondre à une demande légale.
			</p>

			<h2 id="8">Article 8 – Signalements, modération et sanctions</h2>
			<ul>
				<li>Tout membre peut signaler une publication, un commentaire, une conversation ou un membre via le bouton « Signaler ». L&apos;auteur du signalement n&apos;est pas révélé.</li>
				<li>L&apos;Éditeur examine les signalements et peut masquer ou supprimer un contenu contraire aux CGU ou à la loi, et suspendre un compte pour une durée déterminée ou indéterminée.</li>
				<li>Une publication ou un commentaire ayant reçu trois signalements de membres inscrits depuis plus de 7 jours est masqué automatiquement jusqu&apos;à examen.</li>
				<li>
					L&apos;auteur est averti par notification lorsque son contenu est masqué ou rétabli. Il peut demander les motifs de la décision ou la contester en écrivant à {contact} ;
					l&apos;Éditeur réexamine la décision et lui répond.
				</li>
				<li>Un membre suspendu peut se connecter et consulter le Service, mais ne peut plus publier, commenter, envoyer de messages ni téléverser de photos.</li>
				<li>Un membre peut bloquer un autre membre dans la messagerie : aucun des deux ne peut alors écrire à l&apos;autre ni ouvrir de nouvelle conversation.</li>
			</ul>

			<h2 id="9">Article 9 – Suppression du compte</h2>
			<p>
				Le membre peut supprimer son compte à tout moment depuis « Mon compte » &gt; « Supprimer mon compte ». Le sort des données est décrit dans la
				<Link href="/privacy?lang=fr"> politique de confidentialité</Link>. L&apos;Éditeur peut supprimer le compte d&apos;un membre en cas de manquement grave ou répété à l&apos;article 6.
			</p>

			<h2 id="10">Article 10 – Évolution et fin du Service</h2>
			<p>L&apos;Éditeur peut faire évoluer ou interrompre tout ou partie du Service. En cas de fermeture définitive, les membres sont prévenus au moins 30 jours à l&apos;avance.</p>

			<h2 id="11">Article 11 – Responsabilité</h2>
			<p>
				Sauf faute intentionnelle ou lourde, l&apos;Éditeur n&apos;est pas responsable des transactions entre membres ni des contenus publiés par eux, ni des
				interruptions dues à un cas de force majeure ou à la défaillance d&apos;un prestataire (hébergement, cartographie, envoi d&apos;e-mails). Ces limitations ne
				s&apos;appliquent pas lorsque la loi les interdit, notamment en cas de dommage corporel.
			</p>

			<h2 id="12">Article 12 – Droit applicable, litiges et langue</h2>
			<p>
				Les CGU sont soumises au droit français, sans priver le membre consommateur de la protection que lui assurent les dispositions impératives de la loi de son
				pays de résidence. En cas de litige, le membre contacte d&apos;abord l&apos;Éditeur à {contact} ; à défaut d&apos;accord, les tribunaux compétents selon la loi peuvent être saisis.
				Les CGU existent en coréen et en français ; en cas de différence, la version la plus favorable au membre prévaut.
			</p>

			<p className="updated">Version {LEGAL_VERSION}, en vigueur au {legalDate("fr")}.</p>
		</>
	);
}
