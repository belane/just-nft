# Just NFT
Non-Fungible Token and NFT Auction smart contracts for evm blockchains such as; Ethereum, Polygon, Avalanche, Binance Smart Chain, Fantom, Celo, ...

## NFT Contract

- Role-based token minting control.
- Follows the ERC721 standard with Metadata.
- On-chain Token Hash through `tokenHash(uint256 tokenId)` public method.
- Includes [EIP-2981](https://eips.ethereum.org/EIPS/eip-2981) standard for NFT royalties.
- High Unit Test coverage.

### Variants

1. **NFT by Signature**: Allows mining by submitting a signature of the authorized role (backend). 
2. **NFT with RoyaltySplitter**: Deploy the RoyaltySplitter contract to automatically split (50/50) royalty payments between the author and the project treasury.

## Auction Contract

- English Auction.
- Optional auction fee.
- Auto payback for last bidder.
- High Unit Test coverage.

## Unit Test Coverage

File                     |  % Stmts | % Branch |  % Funcs |  % Lines |
-------------------------|----------|----------|----------|----------|
NFT.sol                  |      100 |      100 |      100 |      100 |
NFTAuction.sol           |      100 |       80 |      100 |      100 |
NFTRoyaltySplitter.sol   |      100 |      100 |      100 |      100 |
NFTbySignature.sol       |      100 |      100 |      100 |      100 |
ERC2981Royalties.sol     |      100 |      100 |      100 |      100 |
RoyaltySplitter.sol      |      100 |       90 |      100 |      100 |
SafePayment.sol          |      100 |    83.33 |      100 |      100 |
All files                |      100 |    84.21 |      100 |      100 |

## GAS

The project includes [hardhat-gas-reporter](https://www.npmjs.com/package/hardhat-gas-reporter) plugin for calculating current costs.

|  Deployments          |     wei     |
------------------------|-------------|
|  NFT                  |    1973192  |
|  NFTAuction           |    1737559  |
|  NFTbySignature       |    2175583  |
|  NFTRoyaltySplitter   |    2650781  |

|  Contract             |  Method                   |  Avg wei    |
------------------------|---------------------------|-------------|
|  NFT                  |  mintNFT                  |     228877  |
|  NFTAuction           |  bid                      |      62444  |
|  NFTAuction           |  cancelAuction            |     102956  |
|  NFTAuction           |  cancelAuctionWhenPaused  |      98456  |
|  NFTAuction           |  createAuction            |     139029  |
|  NFTAuction           |  finishAuction            |     114669  |
|  NFTAuction           |  pause                    |      27732  |
|  NFTAuction           |  setNFTContract           |      49858  |
|  NFTAuction           |  unpause                  |      27660  |
|  NFTAuction           |  withdrawUnclaimed        |      31378  |
|  NFTbySignature       |  mintNFTbySignature       |     260788  |
|  NFTRoyaltySplitter   |  mintNFT                  |     732066  |
|  RoyaltySplitter      |  getRoyalties             |      37753  |
|  RoyaltySplitter      |  getRoyaltiesToken        |      78658  |
