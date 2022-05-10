const { expect } = require("chai");
const { ethers } = require("hardhat");

const NFT_NAME = "TokenName";
const NFT_SYMBOL = "SYB";
const NFT_HASH = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const NFT_URI = "ipfs://QmeRPkraecZgN6S1dqHAiz123eRviv1Z7tLFaiR6uRKyJa/0";
const ROYALTY_FEE = 1000;


describe("NFT Token by Signature", function () {
    let owner, auctionContract, projectTreasury, author, other, nft, rndNonce, messageHashBytes, signature;

    beforeEach(async () => {
        [owner, auctionContract, projectTreasury, author, other, ...addrs] = await ethers.getSigners();
        rndNonce = Math.floor(Math.random() * 100_000_000_000);
        let network = await ethers.provider.getNetwork();

        const NFT = await ethers.getContractFactory("NFTbySignature", owner);
        nft = await NFT.deploy(NFT_NAME, NFT_SYMBOL, auctionContract.address, projectTreasury.address);
        await nft.deployed();

        let messageHash = ethers.utils.defaultAbiCoder.encode(
            ["address", "string", "bytes32", "uint256", "bool", "uint256", "address", "uint256"],
            [author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, nft.address, network.chainId]
        );
        let ethSignedMessageHash = ethers.utils.keccak256(messageHash);
        messageHashBytes = ethers.utils.arrayify(ethSignedMessageHash)
        signature = await owner.signMessage(messageHashBytes);
    });

    it("mints with valid signature", async function () {
        await expect(await nft.callStatic.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature)).to.equal(0);
        await nft.connect(other).mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature);

        expect(await nft.ownerOf(0)).to.equal(author.address);
        expect(await nft.balanceOf(author.address)).to.equal(1);
        expect(await nft.tokenURI(0)).to.equal(NFT_URI);
        expect(await nft.tokenHash(0)).to.equal(NFT_HASH);
        expect(await nft.getApproved(0)).to.equal(auctionContract.address);
        expect(await nft.tokenHash(1)).to.equal(ethers.constants.HashZero);
        const royalty = await nft.royaltyInfo(0, 10000);
        expect(royalty[0]).to.be.equal(author.address);
        expect(royalty[1].toNumber()).to.be.equal(1000);
    });
    it("does not mint non-authorized signer", async function () {
        badSignature = await other.signMessage(messageHashBytes);
        await expect(nft.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, badSignature)).to.be.revertedWith('Invalid Signature');
    });
    it("does not allow signature reuse", async function () {
        await expect(await nft.callStatic.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature)).to.equal(0);
        await nft.connect(other).mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature);
        await expect(nft.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature)).to.be.revertedWith('Invalid Nonce');
    });
    it("does not allow param alteration", async function () {
        await expect(nft.mintNFTbySignature(other.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature)).to.be.revertedWith('Invalid Signature');
        await expect(nft.mintNFTbySignature(author.address, NFT_URI.slice(0,-1), NFT_HASH, ROYALTY_FEE, true, rndNonce, signature)).to.be.revertedWith('Invalid Signature');
        await expect(nft.mintNFTbySignature(author.address, NFT_URI, ethers.constants.HashZero, ROYALTY_FEE, true, rndNonce, signature)).to.be.revertedWith('Invalid Signature');
        await expect(nft.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE - 1, true, rndNonce, signature)).to.be.revertedWith('Invalid Signature');
        await expect(nft.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, false, rndNonce, signature)).to.be.revertedWith('Invalid Signature');
        await expect(nft.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce - 1, signature)).to.be.revertedWith('Invalid Signature');

        await expect(await nft.callStatic.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature)).to.equal(0);
    });
    it("does not allow signature alteration", async function () {
        await expect(nft.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature.slice(0,-2))).to.be.revertedWith('Invalid Signature length');
        await expect(nft.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature + 'ff')).to.be.revertedWith('Invalid Signature length');
        await expect(nft.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature.slice(0,-4) + 'ffff')).to.be.revertedWith('Invalid Signature');

        await expect(await nft.callStatic.mintNFTbySignature(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true, rndNonce, signature)).to.equal(0);
    });
});
