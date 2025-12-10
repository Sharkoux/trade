import Link from 'next/link';

export default function Disclaimer({ variant = 'banner' }) {
  if (variant === 'banner') {
    return (
      <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
        <p className="text-xs text-yellow-400/80 text-center">
          <span className="font-medium">Avertissement :</span> Cet outil est fourni a titre informatif uniquement.
          Ce n'est pas un conseil en investissement.{' '}
          <Link href="/terms" className="underline hover:text-yellow-300">
            Voir les conditions
          </Link>
        </p>
      </div>
    );
  }

  if (variant === 'footer') {
    return (
      <div className="mt-6 p-4 rounded-lg bg-[#0d0d0f] border border-[#1f1f23]">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-yellow-500 font-medium">Avertissement sur les risques :</span> Le trading de crypto-monnaies
          comporte des risques importants de perte en capital. Les performances passees ne garantissent pas les resultats futurs.
          Les signaux et analyses fournis par SpreadLab sont a titre informatif uniquement et ne constituent pas des conseils
          en investissement. Vous etes seul responsable de vos decisions de trading.{' '}
          <Link href="/terms" className="text-blue-400 hover:underline">
            Lire les conditions d'utilisation
          </Link>
        </p>
      </div>
    );
  }

  // Compact version for cards
  return (
    <p className="text-[10px] text-gray-600 mt-2">
      Usage informatif uniquement.{' '}
      <Link href="/terms" className="text-gray-500 hover:text-gray-400 underline">
        CGU
      </Link>
    </p>
  );
}
