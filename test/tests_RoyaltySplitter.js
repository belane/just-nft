const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");

const NFT_NAME = "TokenName";
const NFT_SYMBOL = "SYB";
const NFT_HASH = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const NFT_URI = "ipfs://QmeRPkraecZgN6S1dqHAiz123eRviv1Z7tLFaiR6uRKyJa/0";
const ROYALTY_FEE = 1000;
const LOW_GAS = 30_000;


describe("RoyaltySplitter", function () {
    let owner, auctionContract, projectTreasury, author, other, nft;
    let royaltySplitter, NFTroyaltySplitter;
    let sendEther;

    beforeEach(async () => {
        [owner, auctionContract, projectTreasury, author, other, ...addrs] = await ethers.getSigners();

        const RS = await ethers.getContractFactory("RoyaltySplitter", owner);
        royaltySplitter = await RS.deploy(author.address, projectTreasury.address);
        await royaltySplitter.deployed();

        const NFT = await ethers.getContractFactory("NFTRoyaltySplitter", owner);
        nft = await NFT.deploy(NFT_NAME, NFT_SYMBOL, auctionContract.address, projectTreasury.address);
        await nft.deployed();
        const mintTx = await nft.mintNFT(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true);
        await mintTx.wait();
        const royalty = await nft.royaltyInfo(0, 10000);
        NFTroyaltySplitter = await RS.attach(royalty[0]);
    });

    describe("Raw implementation", () => {
        it("receive emits event on payments", async function () {
            await expect(owner.sendTransaction({ to: royaltySplitter.address, value: 1000 }))
                .to.emit(royaltySplitter, "RoyaltyReceived")
                .withArgs(owner.address, 1000);
        });
        it("receive auto splits royalties", async function () {
            expect(await owner.sendTransaction({ to: royaltySplitter.address, value: 2000 }))
                .to.changeBalances([author, projectTreasury], [1000, 1000]);
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("receive keeps payment on low gas", async function () {
            await owner.sendTransaction({ to: royaltySplitter.address, value: 2000, gasLimit: LOW_GAS });
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(2000);
        });
        it("fallback emits event on payments", async function () {
            await expect(owner.sendTransaction({ to: royaltySplitter.address, data: "0x1234", value: 1000 }))
                .to.emit(royaltySplitter, "RoyaltyReceived")
                .withArgs(owner.address, 1000);
        });
        it("fallback auto splits royalties", async function () {
            expect(await owner.sendTransaction({ to: royaltySplitter.address, data: "0x1234", value: 2000 }))
                .to.changeBalances([author, projectTreasury], [1000, 1000]);
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("fallback keeps payment on low gas", async function () {
            await owner.sendTransaction({ to: royaltySplitter.address, data: "0x1234", value: 2000, gasLimit: LOW_GAS });
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(2000);
        });
        it("author distributes pending royalties", async function () {
            await owner.sendTransaction({ to: royaltySplitter.address, value: 4000, gasLimit: LOW_GAS });
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(4000);
            await expect(await royaltySplitter.connect(author).getRoyalties()).to.changeBalance(projectTreasury, 2000);
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("treasury distributes pending royalties", async function () {
            await owner.sendTransaction({ to: royaltySplitter.address, value: 4000, gasLimit: LOW_GAS });
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(4000);
            await expect(await royaltySplitter.connect(projectTreasury).getRoyalties()).to.changeBalance(author, 2000);
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("ERC20 Token royalties works", async function () {
            const TOKEN = await ethers.getContractFactory("ERC20Mock", owner);
            token = await TOKEN.deploy("MOCK", "MOCK", owner.address, 10_000_000);
            await token.deployed();
            await token.transferInternal(owner.address, royaltySplitter.address, 4_000_000);
            expect(await token.balanceOf(royaltySplitter.address)).to.be.equal(4_000_000);

            await royaltySplitter.connect(author).getRoyaltiesToken(token.address);
            expect(await token.balanceOf(royaltySplitter.address)).to.be.equal(0);
            expect(await token.balanceOf(author.address)).to.be.equal(2_000_000);
            expect(await token.balanceOf(projectTreasury.address)).to.be.equal(2_000_000);
        });
        it("does not allow third party to distribute pending royalties", async function () {
            await owner.sendTransaction({ to: royaltySplitter.address, value: 4000, gasLimit: LOW_GAS });
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(4000);
            await expect(
                royaltySplitter.connect(other).getRoyalties()
            ).to.be.revertedWith("No Authorized");
            await expect(
                royaltySplitter.connect(other).getRoyaltiesToken(other.address)
            ).to.be.revertedWith("No Authorized");
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(4000);
        });
    });

    describe("Use on NFT Royalties", () => {
        it("receive emits event on payments", async function () {
            await expect(owner.sendTransaction({ to: NFTroyaltySplitter.address, value: 1000 }))
                .to.emit(NFTroyaltySplitter, "RoyaltyReceived")
                .withArgs(owner.address, 1000);
        });
        it("receive auto splits royalties", async function () {
            expect(await owner.sendTransaction({ to: NFTroyaltySplitter.address, value: 2000 }))
                .to.changeBalances([author, projectTreasury], [1000, 1000]);
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("receive keeps payment on low gas", async function () {
            await owner.sendTransaction({ to: NFTroyaltySplitter.address, value: 2000, gasLimit: LOW_GAS });
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(2000);
        });
        it("fallback emits event on payments", async function () {
            await expect(owner.sendTransaction({ to: NFTroyaltySplitter.address, data: "0x1234", value: 1000 }))
                .to.emit(NFTroyaltySplitter, "RoyaltyReceived")
                .withArgs(owner.address, 1000);
        });
        it("fallback auto splits royalties", async function () {
            expect(await owner.sendTransaction({ to: NFTroyaltySplitter.address, data: "0x1234", value: 2000 }))
                .to.changeBalances([author, projectTreasury], [1000, 1000]);
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("fallback keeps payment on low gas", async function () {
            await owner.sendTransaction({ to: NFTroyaltySplitter.address, data: "0x1234", value: 2000, gasLimit: LOW_GAS });
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(2000);
        });
        it("author distributes pending royalties", async function () {
            await owner.sendTransaction({ to: NFTroyaltySplitter.address, value: 4000, gasLimit: LOW_GAS });
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(4000);
            await expect(await NFTroyaltySplitter.connect(author).getRoyalties()).to.changeBalance(projectTreasury, 2000);
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("treasury distributes pending royalties", async function () {
            await owner.sendTransaction({ to: NFTroyaltySplitter.address, value: 4000, gasLimit: LOW_GAS });
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(4000);
            await expect(await NFTroyaltySplitter.connect(projectTreasury).getRoyalties()).to.changeBalance(author, 2000);
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("ERC20 Token royalties works", async function () {
            const TOKEN = await ethers.getContractFactory("ERC20Mock", owner);
            token = await TOKEN.deploy("MOCK", "MOCK", owner.address, 10_000_000);
            await token.deployed();
            await token.transferInternal(owner.address, NFTroyaltySplitter.address, 4_000_000);
            expect(await token.balanceOf(NFTroyaltySplitter.address)).to.be.equal(4_000_000);

            await NFTroyaltySplitter.connect(author).getRoyaltiesToken(token.address);
            expect(await token.balanceOf(NFTroyaltySplitter.address)).to.be.equal(0);
            expect(await token.balanceOf(author.address)).to.be.equal(2_000_000);
            expect(await token.balanceOf(projectTreasury.address)).to.be.equal(2_000_000);
        });
        it("does not allow third party to distribute pending royalties", async function () {
            await owner.sendTransaction({ to: NFTroyaltySplitter.address, value: 4000, gasLimit: LOW_GAS });
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(4000);
            await expect(
                NFTroyaltySplitter.connect(other).getRoyalties()
            ).to.be.revertedWith("No Authorized");
            await expect(
                NFTroyaltySplitter.connect(other).getRoyaltiesToken(other.address)
            ).to.be.revertedWith("No Authorized");
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(4000);
        });
    });

    describe("Payment on Raw implementation", () => {
        beforeEach(async () => {
            const SE = await ethers.getContractFactory("SendEtherMock", owner);
            sendEther = await SE.deploy();
            await sendEther.deployed();
        });
        it("works when the contract distributes royalties through 'call'", async function () {
            await expect(await sendEther.sendViaCall(royaltySplitter.address, { value: parseEther("10") }))
                .to.emit(royaltySplitter, "RoyaltyReceived")
                .withArgs(sendEther.address, parseEther("10"))
                .and.to.changeBalance(owner, parseEther("-10"))
                .and.to.changeBalance(author, parseEther("5"))
                .and.to.changeBalance(projectTreasury, parseEther("5"));
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("works when the contract distributes royalties through 'send'", async function () {
            await expect(await sendEther.sendViaSend(royaltySplitter.address, { value: parseEther("10") }))
                .to.emit(royaltySplitter, "RoyaltyReceived")
                .withArgs(sendEther.address, parseEther("10"))
                .and.to.changeBalance(owner, parseEther("-10"))
                .and.to.changeBalance(royaltySplitter, parseEther("10"));
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(parseEther("10"));
        });
        it("works when the contract distributes royalties through 'transfer'", async function () {
            await expect(await sendEther.sendViaTransfer(royaltySplitter.address, { value: parseEther("10") }))
                .to.emit(royaltySplitter, "RoyaltyReceived")
                .withArgs(sendEther.address, parseEther("10"))
                .and.to.changeBalance(owner, parseEther("-10"))
                .and.to.changeBalance(royaltySplitter, parseEther("10"));
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(parseEther("10"));
        });
    });

    describe("Payment on NFT Royalties", () => {
        beforeEach(async () => {
            const SE = await ethers.getContractFactory("SendEtherMock", owner);
            sendEther = await SE.deploy();
            await sendEther.deployed();
        });
        it("works when the contract distributes royalties through 'call'", async function () {
            await expect(await sendEther.sendViaCall(NFTroyaltySplitter.address, { value: parseEther("10") }))
                .to.emit(NFTroyaltySplitter, "RoyaltyReceived")
                .withArgs(sendEther.address, parseEther("10"))
                .and.to.changeBalance(owner, parseEther("-10"))
                .and.to.changeBalance(author, parseEther("5"))
                .and.to.changeBalance(projectTreasury, parseEther("5"));
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("works when the contract distributes royalties through 'send'", async function () {
            await expect(await sendEther.sendViaSend(NFTroyaltySplitter.address, { value: parseEther("10") }))
                .to.emit(NFTroyaltySplitter, "RoyaltyReceived")
                .withArgs(sendEther.address, parseEther("10"))
                .and.to.changeBalance(owner, parseEther("-10"))
                .and.to.changeBalance(NFTroyaltySplitter, parseEther("10"));
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(parseEther("10"));
        });
        it("works when the contract distributes royalties through 'transfer'", async function () {
            await expect(await sendEther.sendViaTransfer(NFTroyaltySplitter.address, { value: parseEther("10") }))
                .to.emit(NFTroyaltySplitter, "RoyaltyReceived")
                .withArgs(sendEther.address, parseEther("10"))
                .and.to.changeBalance(owner, parseEther("-10"))
                .and.to.changeBalance(NFTroyaltySplitter, parseEther("10"));
            expect(await NFTroyaltySplitter.showPendingRoyalties()).to.be.equal(parseEther("10"));
        });
    });
});
