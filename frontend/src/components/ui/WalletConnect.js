import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useState } from 'react';

export default function WalletConnect({ compact = false }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showModal, setShowModal] = useState(false);

  const shortenAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected) {
    return (
      <div className={compact ? '' : 'p-3 rounded-lg bg-[#151518]'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-gray-400">Connecte</span>
          </div>
          <button
            onClick={() => disconnect()}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Deconnecter
          </button>
        </div>
        <p className="text-sm font-mono text-white mt-1">
          {shortenAddress(address)}
        </p>
        {!compact && (
          <p className="text-[10px] text-gray-600 mt-1">
            Lecture seule - Aucun acces aux fonds
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isPending}
        className={`w-full flex items-center justify-center gap-2 ${
          compact
            ? 'p-2 rounded-lg bg-[#1f1f23] hover:bg-[#2a2a32] text-gray-400 hover:text-white'
            : 'p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
        } transition-colors`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span className="text-sm font-medium">
          {isPending ? 'Connexion...' : 'Connecter Wallet'}
        </span>
      </button>

      {/* Modal de connexion */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Connecter Wallet</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Info lecture seule */}
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <p className="text-sm text-green-400 font-medium">Lecture seule</p>
                  <p className="text-xs text-gray-400 mt-1">
                    SpreadLab peut uniquement voir vos positions.
                    Aucun acces a vos fonds ou execution de trades.
                  </p>
                </div>
              </div>
            </div>

            {/* Liste des connecteurs */}
            <div className="space-y-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => {
                    connect({ connector });
                    setShowModal(false);
                  }}
                  disabled={isPending}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#1f1f23] hover:bg-[#2a2a32] transition-colors disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#2a2a32] flex items-center justify-center">
                    {connector.name === 'MetaMask' ? (
                      <span className="text-lg">🦊</span>
                    ) : connector.name === 'WalletConnect' ? (
                      <span className="text-lg">🔗</span>
                    ) : (
                      <span className="text-lg">👛</span>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{connector.name}</p>
                    <p className="text-xs text-gray-500">
                      {connector.name === 'MetaMask' && 'Extension navigateur'}
                      {connector.name === 'WalletConnect' && 'Scan QR code'}
                      {connector.name === 'Injected' && 'Wallet detecte'}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-[10px] text-gray-600 mt-4 text-center">
              En connectant votre wallet, vous acceptez les{' '}
              <a href="/terms" className="text-blue-400 hover:underline">conditions d'utilisation</a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
