// src/components/GlossarySpread.js
export default function GlossarySpread() {
  return (
    <div className="mt-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-xs md:text-sm text-slate-200">
      <h2 className="text-sm md:text-base font-semibold mb-2">📚 Glossaire – termes utilisés</h2>

      <ul className="space-y-1.5">
        <li>
          <span className="font-semibold">Ratio</span> : prix du token A divisé par le prix du token B
          (ex : OP / ARB). C&apos;est cette valeur que l&apos;on surveille pour faire du spread.
        </li>
        <li>
          <span className="font-semibold">Réversion à la moyenne (mean reversion)</span> : idée que
          le ratio revient souvent vers sa valeur “habituelle” après un gros écart (sur- ou sous-évaluation).
        </li>
        <li>
          <span className="font-semibold">Score</span> : note de 0 à 100 qui combine la corrélation et
          la capacité du ratio à revenir vers sa moyenne. Plus le score est élevé, plus la paire est
          intéressante pour une stratégie de spread.
        </li>
        <li>
          <span className="font-semibold">Corrélation</span> : mesure entre -1 et 1 de la façon dont
          les deux tokens bougent ensemble. Proche de 1 = ils évoluent dans le même sens ; proche de 0
          = peu liés ; proche de -1 = évoluent dans des sens opposés.
        </li>
        <li>
          <span className="font-semibold">Taux de réversion</span> : pourcentage de cas où un gros
          écart au ratio moyen est suivi d&apos;un retour vers la moyenne dans une fenêtre de temps
          donnée.
        </li>
        <li>
          <span className="font-semibold">z-score</span> : indique de combien d&apos;écarts-types le
          ratio actuel est au-dessus ou en dessous de sa moyenne historique. |z| élevé = écart extrême.
        </li>
        <li>
          <span className="font-semibold">zEnter</span> : seuil de z-score à partir duquel la
          stratégie ouvre une position (par exemple z &gt; 1.5 = ratio très haut → short ratio).
        </li>
        <li>
          <span className="font-semibold">zExit</span> : seuil de z-score vers lequel on attend que le
          ratio revienne pour clôturer la position (par exemple |z| &lt; 0.5 = retour vers la moyenne).
        </li>
        <li>
          <span className="font-semibold">Backtest</span> : simulation de la stratégie (entrées /
          sorties automatiques) sur des données historiques, pour voir ce qu&apos;elle aurait donné
          dans le passé.
        </li>
        <li>
          <span className="font-semibold">PnL</span> (Profit &amp; Loss) : résultat de la stratégie
          (gains ou pertes), exprimé ici en USDC.
        </li>
        <li>
          <span className="font-semibold">Période (1m / 3m / 6m / 1y)</span> : durée d&apos;historique
          utilisée pour calculer les stats et le backtest (1 mois, 3 mois, etc.).
        </li>
      </ul>
    </div>
  );
}
