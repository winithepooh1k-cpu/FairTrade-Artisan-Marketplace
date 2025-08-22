# 🛍️ FairTrade Artisan Marketplace

Welcome to a decentralized marketplace built on the Stacks blockchain that empowers artisans worldwide! This Web3 project addresses real-world issues in fair trade by eliminating middlemen, ensuring transparent and direct payments to creators, verifying product authenticity, and fostering trust through blockchain immutability. Artisans from developing regions often face exploitation, counterfeit goods, and delayed payments—our platform solves this by enabling peer-to-peer sales with smart contract-enforced fairness.

## ✨ Features

🌍 Global artisan registration with identity verification  
🖼️ NFT-based product listings for unique, authentic goods  
💸 Direct, escrow-protected payments in STX or custom tokens  
🔍 Transparent supply chain tracking via on-chain metadata  
⭐ Community-driven reviews and ratings  
⚖️ Automated dispute resolution with governance voting  
🔄 Resale royalties to support ongoing creator earnings  
📈 Analytics dashboard for sales and impact tracking (off-chain integration)  
🚫 Anti-counterfeit measures using digital hashes  

## 🛠 How It Works

**For Artisans (Creators)**  
- Register your profile with basic info and a proof-of-identity hash.  
- Mint an NFT for your artisan good, including a unique hash of the physical item (e.g., photo or serial).  
- List the item on the marketplace with price, description, and shipping details.  
- Once sold, funds are held in escrow until buyer confirms receipt—then payments release directly to you, minus any platform fees.  
- Earn royalties on future resales automatically via smart contracts.  

**For Buyers**  
- Browse verified artisan listings with full transparency on origin and authenticity.  
- Purchase using STX, with funds escrowed securely.  
- Confirm delivery to release payment; dispute if needed via on-chain voting.  
- Leave reviews to build community trust—ratings affect seller visibility.  

**For Verifiers/Community**  
- Use tools to check product hashes against on-chain records for authenticity.  
- Participate in governance to vote on disputes or platform updates.  
- Access analytics to see real-world impact, like total earnings distributed to artisans.  

That's it! A seamless, trustless ecosystem that puts power back in the hands of creators.

## 📜 Smart Contracts (Clarity Implementation)

This project leverages 8 smart contracts written in Clarity for security and efficiency on the Stacks blockchain. Here's a high-level overview:

1. **UserRegistry.clar**: Handles registration of artisans, buyers, and verifiers. Stores profiles with principal addresses, metadata (e.g., location, bio), and basic KYC hashes. Includes functions like `register-user` and `get-user-details`.  

2. **NFTMint.clar**: Manages minting NFTs for artisan goods using the SIP-009 standard. Each NFT includes a unique item hash, description, and metadata URI. Functions: `mint-nft`, `transfer-nft`.  

3. **MarketplaceListing.clar**: Allows listing NFTs for sale with fixed prices or auctions. Tracks listings, bids, and sales. Key functions: `list-item`, `place-bid`, `accept-offer`.  

4. **EscrowPayment.clar**: Securely holds STX or tokens during transactions. Releases funds on buyer confirmation or after a timeout. Includes `initiate-escrow`, `release-funds`, `refund-buyer`.  

5. **RoyaltyDistribution.clar**: Enforces automatic royalties (e.g., 10%) on NFT resales. Tracks ownership history and distributes shares to original creators. Functions: `calculate-royalty`, `distribute-royalty`.  

6. **ReviewSystem.clar**: Enables on-chain reviews and ratings post-transaction. Aggregates scores for users and items. Functions: `submit-review`, `get-average-rating`.  

7. **DisputeResolution.clar**: Manages disputes with timed voting periods for community governance. Locks funds during resolution. Key functions: `initiate-dispute`, `vote-on-dispute`, `resolve-dispute`.  

8. **GovernanceToken.clar**: Issues a fungible token (SIP-010) for platform governance. Holders vote on proposals like fee changes. Functions: `mint-token`, `propose-vote`, `execute-proposal`.  

These contracts interact seamlessly—for example, a sale in MarketplaceListing triggers EscrowPayment and updates NFT ownership, ensuring end-to-end transparency. Deploy them on Stacks for a fully decentralized fair trade revolution!