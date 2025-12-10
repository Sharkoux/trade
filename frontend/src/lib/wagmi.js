import { http, createConfig } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Hyperliquid est sur Arbitrum
// On utilise uniquement injected (MetaMask) pour éviter les conflits de dépendances
export const config = createConfig({
  chains: [arbitrum],
  connectors: [
    injected(),
  ],
  transports: {
    [arbitrum.id]: http(),
  },
});
