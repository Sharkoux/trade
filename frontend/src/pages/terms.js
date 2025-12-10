import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
          ← Retour au Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-white mt-4">Conditions d'Utilisation</h1>
        <p className="text-gray-400 mt-2">Derniere mise a jour : {new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      <div className="space-y-8 text-gray-300">
        {/* Avertissement important */}
        <div className="card p-6 bg-red-500/10 border-red-500/30">
          <h2 className="text-xl font-semibold text-red-400 mb-3">Avertissement Important</h2>
          <p className="leading-relaxed">
            <strong>SpreadLab est un outil d'analyse et d'information.</strong> Les informations, signaux et analyses
            fournis par cette application sont destines a des fins educatives et informatives uniquement.
            <strong className="text-red-400"> Ils ne constituent en aucun cas des conseils en investissement,
            des recommandations d'achat ou de vente, ni une incitation a trader.</strong>
          </p>
        </div>

        {/* Nature du service */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">1. Nature du Service</h2>
          <p className="leading-relaxed mb-3">
            SpreadLab est une application web qui fournit :
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>Des outils d'analyse de paires de crypto-monnaies pour le spread trading</li>
            <li>Des indicateurs statistiques (z-score, correlation, volatilite)</li>
            <li>Des backtests historiques bases sur des donnees passees</li>
            <li>Des signaux generes algorithmiquement a titre indicatif</li>
            <li>La lecture seule de vos positions sur Hyperliquid (si vous connectez votre wallet)</li>
          </ul>
          <p className="mt-3 text-yellow-400">
            SpreadLab ne gere pas vos fonds, n'execute pas de trades en votre nom, et ne stocke pas vos cles privees.
          </p>
        </section>

        {/* Risques */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">2. Risques lies au Trading</h2>
          <p className="leading-relaxed mb-3">
            Le trading de crypto-monnaies et de produits derives (perpetuels) comporte des risques significatifs :
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li><strong className="text-white">Risque de perte en capital :</strong> Vous pouvez perdre tout ou partie de votre investissement</li>
            <li><strong className="text-white">Risque de levier :</strong> L'utilisation du levier amplifie les gains ET les pertes</li>
            <li><strong className="text-white">Risque de liquidation :</strong> Vos positions peuvent etre liquidees automatiquement</li>
            <li><strong className="text-white">Risque de volatilite :</strong> Les prix des crypto-monnaies sont extremement volatils</li>
            <li><strong className="text-white">Risque de marche :</strong> Les conditions de marche peuvent changer rapidement</li>
          </ul>
        </section>

        {/* Limitation de responsabilite */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">3. Limitation de Responsabilite</h2>
          <div className="space-y-3">
            <p className="leading-relaxed">
              <strong className="text-white">3.1</strong> Les createurs et operateurs de SpreadLab ne peuvent etre tenus
              responsables des pertes financieres resultant de l'utilisation de cet outil.
            </p>
            <p className="leading-relaxed">
              <strong className="text-white">3.2</strong> Les performances passees affichees dans les backtests ne
              garantissent pas les resultats futurs. Les conditions de marche changent constamment.
            </p>
            <p className="leading-relaxed">
              <strong className="text-white">3.3</strong> Les signaux generes sont bases sur des algorithmes mathematiques
              et peuvent etre inexacts, retardes, ou ne pas refleter les conditions actuelles du marche.
            </p>
            <p className="leading-relaxed">
              <strong className="text-white">3.4</strong> L'utilisateur est seul responsable de ses decisions de trading
              et doit faire ses propres recherches (DYOR - Do Your Own Research) avant toute operation.
            </p>
          </div>
        </section>

        {/* Connexion Wallet */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">4. Connexion Wallet (Lecture Seule)</h2>
          <div className="space-y-3">
            <p className="leading-relaxed">
              <strong className="text-white">4.1</strong> Si vous choisissez de connecter votre wallet, SpreadLab
              accede uniquement en <strong className="text-green-400">lecture seule</strong> a vos informations publiques
              sur Hyperliquid (positions, PnL, historique).
            </p>
            <p className="leading-relaxed">
              <strong className="text-white">4.2</strong> SpreadLab <strong className="text-green-400">ne peut pas</strong> :
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400 ml-4">
              <li>Executer des transactions en votre nom</li>
              <li>Acceder a vos fonds ou les transferer</li>
              <li>Modifier vos positions</li>
              <li>Stocker votre cle privee</li>
            </ul>
            <p className="leading-relaxed">
              <strong className="text-white">4.3</strong> Vous pouvez deconnecter votre wallet a tout moment.
            </p>
          </div>
        </section>

        {/* Donnees */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">5. Donnees et Confidentialite</h2>
          <div className="space-y-3">
            <p className="leading-relaxed">
              <strong className="text-white">5.1</strong> SpreadLab stocke localement (dans votre navigateur) :
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400 ml-4">
              <li>Votre watchlist de paires favorites</li>
              <li>L'historique des trades que vous enregistrez manuellement</li>
              <li>Vos preferences d'affichage</li>
            </ul>
            <p className="leading-relaxed">
              <strong className="text-white">5.2</strong> Ces donnees restent sur votre appareil et ne sont pas
              transmises a des serveurs externes.
            </p>
          </div>
        </section>

        {/* Utilisation acceptable */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">6. Utilisation Acceptable</h2>
          <p className="leading-relaxed">
            En utilisant SpreadLab, vous acceptez de :
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
            <li>Utiliser l'outil a titre personnel et informatif</li>
            <li>Ne pas redistribuer les signaux a des fins commerciales sans autorisation</li>
            <li>Comprendre que vous etes seul responsable de vos decisions de trading</li>
            <li>Ne pas utiliser l'outil pour des activites illegales</li>
          </ul>
        </section>

        {/* Modifications */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">7. Modifications</h2>
          <p className="leading-relaxed">
            Ces conditions d'utilisation peuvent etre modifiees a tout moment. L'utilisation continue de
            SpreadLab apres modification vaut acceptation des nouvelles conditions.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">8. Contact</h2>
          <p className="leading-relaxed">
            Pour toute question concernant ces conditions, vous pouvez nous contacter via les canaux
            officiels du projet.
          </p>
        </section>

        {/* Acceptation */}
        <div className="card p-6 bg-blue-500/10 border-blue-500/30">
          <h2 className="text-xl font-semibold text-blue-400 mb-3">Acceptation des Conditions</h2>
          <p className="leading-relaxed">
            En utilisant SpreadLab, vous reconnaissez avoir lu, compris et accepte l'ensemble de ces
            conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser
            cette application.
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="btn btn-primary">
          Retour au Dashboard
        </Link>
      </div>
    </div>
  );
}
