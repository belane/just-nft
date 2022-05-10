const { expect } = require("chai");
const { ethers } = require("hardhat");

const NFT_NAME = "TokenName";
const NFT_SYMBOL = "SYB";
const NFT_HASH = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const NFT_URI = "ipfs://QmeRPkraecZgN6S1dqHAiz123eRviv1Z7tLFaiR6uRKyJa/0";
const ROYALTY_FEE = 1000;


describe("NFT Token", function () {
    let owner, auctionContract, projectTreasury, author, other, nft;

    beforeEach(async () => {
        [owner, auctionContract, projectTreasury, author, other, ...addrs] = await ethers.getSigners();
        const NFT = await ethers.getContractFactory("NFT", owner);
        nft = await NFT.deploy(NFT_NAME, NFT_SYMBOL, auctionContract.address, projectTreasury.address);
        await nft.deployed();
    });
  
    describe("ERC165 Supported Interfaces", () => {
        it("should support ERC165", async function () {
            // ERC165 == 0x01ffc9a7
            expect(await nft.supportsInterface(0x01ffc9a7)).to.be.true;
        });
        it("should support IERC721", async function () {
            // IERC721 == 0x80ac58cd
            expect(await nft.supportsInterface(0x80ac58cd)).to.be.true;
        });
        it("should support IERC721Metadata", async function () {
            // IERC721Metadata == 0x5b5e139f
            expect(await nft.supportsInterface(0x5b5e139f)).to.be.true;
        });
        it("should support IERC2981", async function () {
            // IERC2981 == 0x2a55205a
            expect(await nft.supportsInterface(0x2a55205a)).to.be.true;
        });
        it("should support IAccessControl", async function () {
            // IAccessControl == 0x7965db0b
            expect(await nft.supportsInterface(0x7965db0b)).to.be.true;
        });
        it("should return false on non supported interfaces", async function () {
            expect(await nft.supportsInterface(0x01234567)).to.be.false;
        });  
    });

    describe("NFT Minting", () => {
        beforeEach(async () => {
            const mintTx = await nft.mintNFT(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true);
            await mintTx.wait();
        });
        it("mints successfully with minting role", async function () {
            expect(await nft.callStatic.mintNFT(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true)).to.equal(1);
            expect(await nft.ownerOf(0)).to.equal(author.address);
            expect(await nft.balanceOf(author.address)).to.equal(1);
        });
        it("successfully mints properties", async function () {
            expect(await nft.ownerOf(0)).to.equal(author.address);
            expect(await nft.tokenURI(0)).to.equal(NFT_URI);
            expect(await nft.tokenHash(0)).to.equal(NFT_HASH);
            expect(await nft.tokenHash(1)).to.equal(ethers.constants.HashZero);
        });
        it("should revert on minting without role", async function () {
            await expect(
                nft.connect(other).mintNFT(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true)
            ).to.be.reverted;
        });
        it("mints with setApprove", async function () {
            const mintTx = await nft.mintNFT(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, false);
            await mintTx.wait();
            expect(await nft.getApproved(0)).to.equal(auctionContract.address);
            expect(await nft.getApproved(1)).to.not.equal(auctionContract.address);
            expect(await nft.getApproved(1)).to.equal(ethers.constants.AddressZero);
        });
    });

    describe("ERC2981 Royalties", () => {
        it("has the right royalties for tokenId", async function () {
            const mintTx = await nft.mintNFT(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, false);
            await mintTx.wait();
            const royalty = await nft.royaltyInfo(0, 10000);
            expect(royalty[0]).to.be.equal(author.address);
            expect(royalty[1].toNumber()).to.be.equal(1000);
        });
        it("has no royalties if not set", async function () {
            const info = await nft.royaltyInfo(2, 100);
            expect(info[1].toNumber()).to.be.equal(0);
            expect(info[0]).to.be.equal(ethers.constants.AddressZero);
        });
        it("should revert if royalties is set to more than 100%", async function () {
            await expect(
                nft.mintNFT(author.address, NFT_URI, NFT_HASH, 10001, false)
            ).to.be.revertedWith("ERC2981Royalties: Too high");
        });
        it("works with zero royalties", async function () {
            const mintTx = await nft.mintNFT(author.address, NFT_URI, NFT_HASH, 0, false);
            await mintTx.wait();
            const royalty = await nft.royaltyInfo(0, 10000);
            expect(royalty[1].toNumber()).to.be.equal(0);
        });
    });
});
