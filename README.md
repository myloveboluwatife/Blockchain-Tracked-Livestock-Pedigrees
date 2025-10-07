# 🐄 Blockchain-Tracked Livestock Pedigrees

Welcome to a decentralized solution for tracking livestock pedigrees on the Stacks blockchain! This project ensures transparent, tamper-proof records of animal lineage, enabling farmers, breeders, and buyers to verify pedigrees, prevent fraud, and maintain trust in livestock markets.

## ✨ Features

- 🐮 **Register Livestock**: Record unique animal details with a hash-based ID.
- 👪 **Track Pedigree**: Link animals to their parents to build immutable lineage records.
- 🔍 **Verify Ownership**: Confirm ownership of registered livestock.
- 📜 **Record Health Data**: Store health and certification details on-chain.
- 🔄 **Transfer Ownership**: Securely transfer livestock ownership between parties.
- ✅ **Prevent Fraud**: Ensure no duplicate registrations or false lineage claims.
- 🌍 **Public Verification**: Allow buyers to verify pedigree and health data.
- 📊 **Analytics**: Provide breeders with insights into lineage trends.

## 🛠 How It Works

**For Breeders/Farmers**
- Generate a unique hash for each animal (e.g., based on DNA or tag ID).
- Register the animal using `register-livestock` with:
  - Animal hash
  - Breed, birth date, and description
  - Parent hashes (if applicable)
- Add health records or certifications using `add-health-record`.
- Transfer ownership to buyers using `transfer-ownership`.

**For Buyers**
- Use `get-livestock-details` to view animal details, pedigree, and health records.
- Call `verify-ownership` to confirm the seller’s ownership.
- Verify lineage using `get-pedigree`.

**For Verifiers**
- Access public pedigree data to confirm authenticity.
- Use `get-lineage-stats` for insights into breed or lineage trends.

