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
    let royaltySplitter, royaltySplitterProxy;
    let sendEther;

    beforeEach(async () => {
        [owner, auctionContract, projectTreasury, author, other, ...addrs] = await ethers.getSigners();
        
        const RS = await ethers.getContractFactory("RoyaltySplitter", owner);
        royaltySplitter = await RS.deploy();
        await royaltySplitter.deployed();
        await royaltySplitter.initialize(author.address, projectTreasury.address)

        const NFT = await ethers.getContractFactory("NFTRoyaltySplitter", owner);
        nft = await NFT.deploy(NFT_NAME, NFT_SYMBOL, auctionContract.address, projectTreasury.address);
        await nft.deployed();

        const mintTx = await nft.mintNFT(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true);
        await mintTx.wait();
        const royalty = await nft.royaltyInfo(0, 10000);
        royaltySplitterProxy = await RS.attach(royalty[0]);
    });

    describe("Raw implementation", () => {
        it("should revert on double initialization", async function () {
            await expect(
                royaltySplitter.initialize(author.address, other.address)
            ).to.be.revertedWith("Already Initialized");
        });
        it("receive emits event on payments", async function () {
            await expect(owner.sendTransaction({to: royaltySplitter.address, value: 1000}))
                .to.emit(royaltySplitter, "RoyaltyReceived")
                .withArgs(owner.address, 1000);
        });
        it("receive auto splits royalties", async function () {
            expect(await owner.sendTransaction({to: royaltySplitter.address, value: 2000}))
                .to.changeBalances([author, projectTreasury], [1000, 1000]);
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("receive keeps payment on low gas", async function () {
            await owner.sendTransaction({to: royaltySplitter.address, value: 2000, gasLimit: LOW_GAS});
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(2000);
        });
        it("fallback emits event on payments", async function () {
            await expect(owner.sendTransaction({to: royaltySplitter.address, data: "0x1234", value: 1000}))
                .to.emit(royaltySplitter, "RoyaltyReceived")
                .withArgs(owner.address, 1000);
        });
        it("fallback auto splits royalties", async function () {
            expect(await owner.sendTransaction({to: royaltySplitter.address, data: "0x1234", value: 2000}))
                .to.changeBalances([author, projectTreasury], [1000, 1000]);
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("fallback keeps payment on low gas", async function () {
            await owner.sendTransaction({to: royaltySplitter.address, data: "0x1234", value: 2000, gasLimit: LOW_GAS});
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(2000);
        });
            it("author distributes pending royalties", async function () {
            await owner.sendTransaction({to: royaltySplitter.address, value: 4000, gasLimit: LOW_GAS});
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(4000);
            await expect(await royaltySplitter.connect(author).getRoyalties()).to.changeBalance(projectTreasury, 2000);
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("treasury distributes pending royalties", async function () {
            await owner.sendTransaction({to: royaltySplitter.address, value: 4000, gasLimit: LOW_GAS});
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
            await owner.sendTransaction({to: royaltySplitter.address, value: 4000, gasLimit: LOW_GAS});
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

    describe("Proxied implementation", () => {
        it("should revert on double initialization", async function () {
            await expect(
                royaltySplitterProxy.initialize(author.address, other.address)
            ).to.be.revertedWith("Already Initialized");
        });
        it("receive emits event on payments", async function () {
            await expect(owner.sendTransaction({to: royaltySplitterProxy.address, value: 1000}))
                .to.emit(royaltySplitterProxy, "RoyaltyReceived")
                .withArgs(owner.address, 1000);
        });
        it("receive auto splits royalties", async function () {
            expect(await owner.sendTransaction({to: royaltySplitterProxy.address, value: 2000}))
                .to.changeBalances([author, projectTreasury], [1000, 1000]);
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(0);
        });
        it("receive keeps payment on low gas", async function () {
            await owner.sendTransaction({to: royaltySplitterProxy.address, value: 2000, gasLimit: LOW_GAS});
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(2000);
        });
        it("fallback emits event on payments", async function () {
            await expect(owner.sendTransaction({to: royaltySplitterProxy.address, data: "0x1234", value: 1000}))
                .to.emit(royaltySplitterProxy, "RoyaltyReceived")
                .withArgs(owner.address, 1000);
        });
        it("fallback auto splits royalties", async function () {
            expect(await owner.sendTransaction({to: royaltySplitterProxy.address, data: "0x1234", value: 2000}))
                .to.changeBalances([author, projectTreasury], [1000, 1000]);
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(0);
        });
        it("fallback keeps payment on low gas", async function () {
            await owner.sendTransaction({to: royaltySplitterProxy.address, data: "0x1234", value: 2000, gasLimit: LOW_GAS});
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(2000);
        });
        it("author distributes pending royalties", async function () {
            await owner.sendTransaction({to: royaltySplitterProxy.address, value: 4000, gasLimit: LOW_GAS});
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(4000);
            await expect(await royaltySplitterProxy.connect(author).getRoyalties()).to.changeBalance(projectTreasury, 2000);
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(0);
        });
        it("treasury distributes pending royalties", async function () {
            await owner.sendTransaction({to: royaltySplitterProxy.address, value: 4000, gasLimit: LOW_GAS});
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(4000);
            await expect(await royaltySplitterProxy.connect(projectTreasury).getRoyalties()).to.changeBalance(author, 2000);
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(0);
        });
        it("ERC20 Token royalties works", async function () {
            const TOKEN = await ethers.getContractFactory("ERC20Mock", owner);
            token = await TOKEN.deploy("MOCK", "MOCK", owner.address, 10_000_000);
            await token.deployed();
            await token.transferInternal(owner.address, royaltySplitterProxy.address, 4_000_000);
            expect(await token.balanceOf(royaltySplitterProxy.address)).to.be.equal(4_000_000);

            await royaltySplitterProxy.connect(author).getRoyaltiesToken(token.address);
            expect(await token.balanceOf(royaltySplitterProxy.address)).to.be.equal(0);
            expect(await token.balanceOf(author.address)).to.be.equal(2_000_000);
            expect(await token.balanceOf(projectTreasury.address)).to.be.equal(2_000_000);
        });
        it("does not allow third party to distribute pending royalties", async function () {
            await owner.sendTransaction({to: royaltySplitterProxy.address, value: 4000, gasLimit: LOW_GAS});
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(4000);
            await expect(
                royaltySplitterProxy.connect(other).getRoyalties()
            ).to.be.revertedWith("No Authorized");
            await expect(
                royaltySplitterProxy.connect(other).getRoyaltiesToken(other.address)
            ).to.be.revertedWith("No Authorized");
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(4000);
        });
    });

    describe("Payment on Raw implementation", () => {
        beforeEach(async () => {
            const SE = await ethers.getContractFactory("SendEtherMock", owner);
            sendEther = await SE.deploy();
            await sendEther.deployed();
        });
        it("works when the contract distributes royalties through 'call'", async function () {
            await expect(sendEther.sendViaCall(royaltySplitter.address, {value: parseEther("10")}))
                .to.emit(royaltySplitter, "RoyaltyReceived")
                .withArgs(sendEther.address, parseEther("10"));
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(0);
        });
        it("works when the contract distributes royalties through 'send'", async function () {
            await expect(sendEther.sendViaSend(royaltySplitter.address, {value: parseEther("10")}))
                .to.emit(royaltySplitter, "RoyaltyReceived")
                .withArgs(sendEther.address, parseEther("10"));
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(parseEther("10"));
        });
        it("works when the contract distributes royalties through 'transfer'", async function () {
            await expect(sendEther.sendViaTransfer(royaltySplitter.address, {value: parseEther("10")}))
                .to.emit(royaltySplitter, "RoyaltyReceived")
                .withArgs(sendEther.address, parseEther("10"));
            expect(await royaltySplitter.showPendingRoyalties()).to.be.equal(parseEther("10"));
        });
    });

    describe("Payment on Proxied implementation", () => {
        beforeEach(async () => {
            const SE = await ethers.getContractFactory("SendEtherMock", owner);
            sendEther = await SE.deploy();
            await sendEther.deployed();
        });
        it("works when the contract distributes royalties through 'call'", async function () {
            await expect(sendEther.sendViaCall(royaltySplitterProxy.address, {value: parseEther("10")}))
                .to.emit(royaltySplitterProxy, "RoyaltyReceived")
                .withArgs(sendEther.address, parseEther("10"));
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(0);
        });
        it("[!] fails when the contract distributes royalties through 'send'", async function () {
            await expect(await sendEther.sendViaSend(royaltySplitterProxy.address, { value: parseEther("10") }))
                .to.changeBalance(sendEther, parseEther("10"));
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(0);
        });
        it("[!] fails when the contract distributes royalties through 'transfer'", async function () {
            await expect(sendEther.sendViaTransfer(royaltySplitterProxy.address, { value: parseEther("10") }))
                .to.be.reverted;
            expect(await royaltySplitterProxy.showPendingRoyalties()).to.be.equal(0);
        });
    });
});
