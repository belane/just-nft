const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");

const NFT_NAME = "TokenName";
const NFT_SYMBOL = "SYB";
const NFT_HASH = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const NFT_URI = "ipfs://QmeRPkraecZgN6S1dqHAiz123eRviv1Z7tLFaiR6uRKyJa/0";
const ROYALTY_FEE = 1000;
const AUCTION_FEE = 2000;
const MIN_BID = parseEther("1");
const LOW_BID = parseEther("7");
const HIGH_BID = parseEther("9");
const MAX_BID = parseEther("10");


describe("NFT Auction", function () {
    let owner, projectTreasury, author, other, auctionContract, nft;

    beforeEach(async () => {
        [owner, projectTreasury, author, other, bidder1, bidder2, ...addrs] = await ethers.getSigners();

        const AUCTION = await ethers.getContractFactory("NFTAuction", owner);
        auctionContract = await AUCTION.deploy(projectTreasury.address, AUCTION_FEE);
        await auctionContract.deployed();

        const NFT = await ethers.getContractFactory("NFT", owner);
        nft = await NFT.deploy(NFT_NAME, NFT_SYMBOL, auctionContract.address, projectTreasury.address);
        await nft.deployed();
        const mintTx = await nft.mintNFT(author.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true);
        await mintTx.wait();
    });
  
    describe("Set NFT", () => {
        it("successfully sets contract", async function () {
            expect(await auctionContract.setNFTContract(nft.address));
            expect(await auctionContract.nftContract()).to.equal(nft.address);
        });
        it("should reverts if already set", async function () {
            expect(await auctionContract.setNFTContract(nft.address));
            expect(await auctionContract.nftContract()).to.equal(nft.address);
            await expect(
                auctionContract.setNFTContract(nft.address)
            ).to.be.revertedWith("NFT Contract already set");
        });
        it("should reverts for non nft contract", async function () {
            await expect(
                auctionContract.setNFTContract(other.address)
            ).to.be.reverted;
        });
    });

    it("Pause and Unpause", async function () {
        await expect(
            await auctionContract.connect(owner).pause()
        ).to.emit(auctionContract,"Paused").withArgs(owner.address);
        await expect(
            auctionContract.connect(owner).createAuction(0, MIN_BID, MAX_BID, 360)
        ).to.be.revertedWith("Pausable: paused");
        await expect(
            await auctionContract.connect(owner).unpause()
        ).to.emit(auctionContract,"Unpaused").withArgs(owner.address);
    });

    describe("Create Auction", () => {
        beforeEach(async () => {
            expect(await auctionContract.setNFTContract(nft.address));
        });
        it("allows the author to create an auction", async function () {
            expect(
                await auctionContract.connect(author).createAuction(0, MIN_BID, MAX_BID, 360)
            ).to.emit(auctionContract,"AuctionCreated").withArgs(0, MIN_BID, MAX_BID, 360);
            const auciontData = await auctionContract.getAuction(0);
            expect(auciontData[0]).to.equal(author.address);
            expect(auciontData[2]).to.equal(MAX_BID);
            expect(await nft.ownerOf(0)).to.equal(auctionContract.address);
        });
        it("allows the owner to create an auction", async function () {
            expect(
                await auctionContract.connect(owner).createAuction(0, MIN_BID, MAX_BID, 360)
            ).to.emit(auctionContract,"AuctionCreated").withArgs(0, MIN_BID, MAX_BID, 360);
            const auciontData = await auctionContract.getAuction(0);
            expect(auciontData[0]).to.equal(author.address);
            expect(auciontData[2]).to.equal(MAX_BID);
            expect(await nft.ownerOf(0)).to.equal(auctionContract.address);
        });
        it("allows multiple auctions", async function () {
            expect(await nft.callStatic.mintNFT(other.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true)).to.equal(1);
            const mintTx = await nft.mintNFT(other.address, NFT_URI, NFT_HASH, ROYALTY_FEE, true);
            await mintTx.wait();
            await expect(
                await auctionContract.connect(owner).createAuction(0, MIN_BID, MAX_BID, 360)
            ).to.emit(auctionContract,"AuctionCreated").withArgs(0, MIN_BID, MAX_BID, 360);
            await expect(
                await auctionContract.connect(owner).createAuction(1, MIN_BID, MAX_BID.mul(2), 3600)
            ).to.emit(auctionContract,"AuctionCreated").withArgs(1, MIN_BID, MAX_BID.mul(2), 3600);

            expect(await nft.ownerOf(0)).to.equal(auctionContract.address);
            expect(await nft.ownerOf(1)).to.equal(auctionContract.address);
            const auciontData1 = await auctionContract.getAuction(0);
            expect(auciontData1[0]).to.equal(author.address);
            expect(auciontData1[2]).to.equal(MAX_BID);
            const auciontData2 = await auctionContract.getAuction(1);
            expect(auciontData2[0]).to.equal(other.address);
            expect(auciontData2[2]).to.equal(MAX_BID.mul(2));
        });
        it("should revert when a duplicate auction is created", async function () {
            const mintTx = await auctionContract.connect(owner).createAuction(0, MIN_BID, MAX_BID, 360);
            await mintTx.wait();
            const auciontData = await auctionContract.getAuction(0);
            expect(auciontData[0]).to.equal(author.address);
            expect(auciontData[2]).to.equal(MAX_BID);
            await expect(
                auctionContract.connect(owner).createAuction(0, MIN_BID, MAX_BID, 360)
            ).to.be.revertedWith("Running Auction");
        });
        it("should revert when third party creates auction", async function () {
            await expect(
                auctionContract.connect(other).createAuction(0, MIN_BID, MAX_BID, 360)
            ).to.be.revertedWith("Not Authorized");
        });
        it("should revert on nonexistent auctions", async function () {
            await expect(
                auctionContract.getAuction(3)
            ).to.be.revertedWith("Not Auction");
        });
    });
    describe("Bid", () => {
        beforeEach(async () => {
            expect(await auctionContract.setNFTContract(nft.address));
            const mintTx2 = await auctionContract.createAuction(0, MIN_BID, MAX_BID, 360);
            await mintTx2.wait();
        });
        it("allows users to bid eth successfully", async function () {
            await expect(
                await auctionContract.connect(bidder1).bid(0, {value: LOW_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, LOW_BID, bidder1.address);

            const auciontData = await auctionContract.getAuction(0);
            const lastBid = await auctionContract.getlastBid(0);
            expect(lastBid).to.equal(LOW_BID);
            expect(auciontData[0]).to.equal(author.address);
            expect(auciontData[1]).to.equal(MIN_BID);
            expect(auciontData[2]).to.equal(MAX_BID);
            expect(auciontData[3]).to.equal(360);
            expect(auciontData[4].toNumber()).to.greaterThan(0);
            expect(auciontData[5]).to.equal(LOW_BID);
            expect(auciontData[6]).to.equal(bidder1.address);
        });
        it("should revert for bids below the opening price", async function () {
            await expect(
                auctionContract.connect(bidder1).bid(0, {value: MIN_BID.div(2)})
            ).to.be.revertedWith("bid bellow min price");
        });
        it("should revert if auction has ended", async function () {
            await ethers.provider.send('evm_increaseTime', [1000]);
            await expect(
                auctionContract.connect(bidder1).bid(0, {value: LOW_BID})
            ).to.be.revertedWith("Auction not open");
        });
        it("should revert for bids below last bid", async function () {
            await expect(
                await auctionContract.connect(bidder1).bid(0, {value: HIGH_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, HIGH_BID, bidder1.address);
            await expect(
                auctionContract.connect(bidder2).bid(0, {value: LOW_BID})
            ).to.be.revertedWith("bid bellow last bid");
        });
        it("should return change for bids over max price", async function () {
            let balance1_bidder1 = await bidder1.getBalance();
            await expect(
                await auctionContract.connect(bidder1).bid(0, {value: MAX_BID.mul(2)})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, MAX_BID, bidder1.address);
            let balance2_bidder1 = await bidder1.getBalance();
            expect(balance1_bidder1.sub(balance2_bidder1).sub(MAX_BID).lt(parseEther("0.001"))).to.be.true;
            await expect(
                auctionContract.connect(bidder2).bid(0, {value: HIGH_BID})
            ).to.be.revertedWith("endingPrice reached");
        });
        it("multiple bids with payback", async function () {
            await expect(
                await auctionContract.connect(bidder1).bid(0, {value: LOW_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, LOW_BID, bidder1.address);
            let auciontData = await auctionContract.getAuction(0);
            expect(auciontData[5]).to.equal(LOW_BID);
            expect(auciontData[6]).to.equal(bidder1.address);
            let balance1_bidder1 = await bidder1.getBalance();

            await expect(
                await auctionContract.connect(bidder2).bid(0, {value: HIGH_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, HIGH_BID, bidder2.address);
            auciontData = await auctionContract.getAuction(0);
            expect(auciontData[5]).to.equal(HIGH_BID);
            expect(auciontData[6]).to.equal(bidder2.address);
            let balance2_bidder1 = await bidder1.getBalance();

            expect(balance2_bidder1.sub(balance1_bidder1).eq(LOW_BID)).to.be.true;
        });
        it("is resilient to malicious bids", async function () {
            const MaliciousBidderMock = await ethers.getContractFactory("MaliciousBidderMock", owner);
            maliciousBidder = await MaliciousBidderMock.deploy();
            await maliciousBidder.deployed();
            const MAL_BID = parseEther("8");

            await expect(
                await auctionContract.connect(bidder1).bid(0, {value: LOW_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, LOW_BID, bidder1.address);
            let auciontData = await auctionContract.getAuction(0);
            expect(auciontData[5]).to.equal(LOW_BID);
            expect(auciontData[6]).to.equal(bidder1.address);
            let balance1_bidder1 = await bidder1.getBalance();

            await expect(
                await maliciousBidder.connect(other).bid(auctionContract.address, 0, {value: MAL_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, MAL_BID, maliciousBidder.address);
            auciontData = await auctionContract.getAuction(0);
            expect(auciontData[5]).to.equal(MAL_BID);
            expect(auciontData[6]).to.equal(maliciousBidder.address);

            let balance2_bidder1 = await bidder1.getBalance();
            expect(balance2_bidder1.sub(balance1_bidder1).eq(LOW_BID)).to.be.true;

            await expect(
                await auctionContract.connect(bidder2).bid(0, {value: HIGH_BID})
            ).to.emit(auctionContract,"FailedPayment").withArgs(maliciousBidder.address, MAL_BID).and
            .to.emit(auctionContract,"AuctionBid").withArgs(0, HIGH_BID, bidder2.address);
            auciontData = await auctionContract.getAuction(0);
            expect(auciontData[5]).to.equal(HIGH_BID);
            expect(auciontData[6]).to.equal(bidder2.address);

            expect(await ethers.provider.getBalance(maliciousBidder.address)).to.equal(0);
            expect(await ethers.provider.getBalance(auctionContract.address)).to.equal(MAL_BID.add(HIGH_BID));

            await expect(
                await auctionContract.connect(owner).pause()
            ).to.emit(auctionContract,"Paused").withArgs(owner.address);
            await expect(
                await auctionContract.connect(owner).withdrawUnclaimed(other.address)
            ).to.changeBalance(other, MAL_BID);

            expect(await ethers.provider.getBalance(auctionContract.address)).to.equal(HIGH_BID);
        });
    });
    describe("Cancel Auction", () => {
        beforeEach(async () => {
            expect(await auctionContract.setNFTContract(nft.address));
            await expect(
                await auctionContract.connect(owner).createAuction(0, MIN_BID, MAX_BID, 360)
            ).to.emit(auctionContract,"AuctionCreated").withArgs(0, MIN_BID, MAX_BID, 360);
            await expect(
                await auctionContract.connect(bidder1).bid(0, {value: LOW_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, LOW_BID, bidder1.address);
        });
        it("allows author to cancel auction", async function () {
            await expect(
                await auctionContract.connect(author).cancelAuction(0)
            ).to.emit(auctionContract,"AuctionCancelled").withArgs(0);
            await expect(
                auctionContract.getAuction(0)
            ).to.be.revertedWith("Not Auction");
        });
        it("returns eth to last bidder and nft to author", async function () {
            await expect(
                await auctionContract.connect(author).cancelAuction(0)
            ).to.changeBalance(bidder1, LOW_BID);          
            expect(await nft.ownerOf(0)).to.equal(author.address);
        });
        it("should revert if anyone else try to cancel auction", async function () {
            await expect(
                auctionContract.connect(owner).cancelAuction(0)
            ).to.be.revertedWith("Only seller can cancel");
        });
        it("should revert if auction has ended", async function () {
            await ethers.provider.send('evm_increaseTime', [1000]);
            await expect(
                auctionContract.connect(author).cancelAuction(0)
            ).to.be.revertedWith("Auction not open");
        });
        it("should revert if contract is paused", async function () {
            await expect(
                await auctionContract.connect(owner).pause()
            ).to.emit(auctionContract,"Paused").withArgs(owner.address);
            await expect(
                auctionContract.connect(author).cancelAuction(0)
            ).to.be.revertedWith("Pausable: paused");
        });
        it("should revert no auction to cancel", async function () {
            await expect(
                auctionContract.connect(author).cancelAuction(1)
            ).to.be.revertedWith("Auction not open");
        });
    });
    describe("Admin Cancel Auction", () => {
        beforeEach(async () => {
            expect(await auctionContract.setNFTContract(nft.address));
            await expect(
                await auctionContract.connect(owner).createAuction(0, MIN_BID, MAX_BID, 360)
            ).to.emit(auctionContract,"AuctionCreated").withArgs(0, MIN_BID, MAX_BID, 360);
            await expect(
                await auctionContract.connect(bidder1).bid(0, {value: LOW_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, LOW_BID, bidder1.address);
        });
        it("allows owner to cancel auction only if contract paused", async function () {
            await expect(
                auctionContract.connect(owner).cancelAuctionWhenPaused(0)
            ).to.be.revertedWith("Pausable: not paused");
            await expect(
                await auctionContract.connect(owner).pause()
            ).to.emit(auctionContract,"Paused").withArgs(owner.address);
            await expect(
                await auctionContract.connect(owner).cancelAuctionWhenPaused(0)
            ).to.emit(auctionContract,"AuctionCancelled").withArgs(0);
            await expect(
                auctionContract.getAuction(0)
            ).to.be.revertedWith("Not Auction");
        });
        it("returns eth to last bidder and nft to author", async function () {
            await expect(
                await auctionContract.connect(owner).pause()
            ).to.emit(auctionContract,"Paused").withArgs(owner.address);
            await expect(
                await auctionContract.connect(owner).cancelAuctionWhenPaused(0)
            ).to.changeBalance(bidder1, LOW_BID);          
            expect(await nft.ownerOf(0)).to.equal(author.address);
        });
        it("should revert if anyone else try to cancel auction", async function () {
            await expect(
                auctionContract.connect(other).pause()
            ).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(
                await auctionContract.connect(owner).pause()
            ).to.emit(auctionContract,"Paused").withArgs(owner.address);
            await expect(
                auctionContract.connect(other).cancelAuctionWhenPaused(0)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
        it("should revert no auction to cancel", async function () {
            await expect(
                await auctionContract.connect(owner).pause()
            ).to.emit(auctionContract,"Paused").withArgs(owner.address);
            await expect(
                auctionContract.connect(owner).cancelAuctionWhenPaused(1)
            ).to.be.revertedWith("Not Auction");
        });
    });
    describe("Finish Auction", () => {
        beforeEach(async () => {
            expect(await auctionContract.setNFTContract(nft.address));
            await expect(
                await auctionContract.connect(owner).createAuction(0, MIN_BID, MAX_BID, 360)
            ).to.emit(auctionContract,"AuctionCreated").withArgs(0, MIN_BID, MAX_BID, 360);
        });
        it("ends auction by time", async function () {
            await expect(
                await auctionContract.connect(bidder1).bid(0, {value: LOW_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, LOW_BID, bidder1.address);
            await ethers.provider.send('evm_increaseTime', [1000]);
            await expect(
                await auctionContract.connect(other).finishAuction(0)
            ).to.emit(auctionContract,"AuctionFinish").withArgs(0, LOW_BID, bidder1.address);
            expect(await nft.ownerOf(0)).to.equal(bidder1.address);
        });
        it("ends auction by time with no bids", async function () {
            await ethers.provider.send('evm_increaseTime', [1000]);
            await expect(
                await auctionContract.connect(other).finishAuction(0)
            ).to.emit(auctionContract,"AuctionFinish").withArgs(0, 0, author.address);
            expect(await nft.ownerOf(0)).to.equal(author.address);
        });
        it("ends auction by max price reached", async function () {
            await expect(
                await auctionContract.connect(bidder1).bid(0, {value: MAX_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, MAX_BID, bidder1.address);
            await expect(
                await auctionContract.connect(other).finishAuction(0)
            ).to.emit(auctionContract,"AuctionFinish").withArgs(0, MAX_BID, bidder1.address);
            expect(await nft.ownerOf(0)).to.equal(bidder1.address);
        });
        it("distribute gains and fee", async function () {
            FEE = MAX_BID.mul(AUCTION_FEE).div(10000)
            await expect(
                await auctionContract.connect(bidder1).bid(0, {value: MAX_BID})
            ).to.emit(auctionContract,"AuctionBid").withArgs(0, MAX_BID, bidder1.address);
            await expect(
                await auctionContract.connect(other).finishAuction(0)
            ).to.changeBalances([projectTreasury, author], [FEE, MAX_BID.sub(FEE)]);
            expect(await nft.ownerOf(0)).to.equal(bidder1.address);
        });
    });
    describe("Withdraw Unclaimed", () => {
        beforeEach(async () => {
            expect(await auctionContract.setNFTContract(nft.address));
            await expect(
                await auctionContract.connect(owner).createAuction(0, MIN_BID, MAX_BID, 360)
            ).to.emit(auctionContract,"AuctionCreated").withArgs(0, MIN_BID, MAX_BID, 360);
        });
        it("allows owner to withdraw unclaimed eth", async function () {
            await expect(
                auctionContract.connect(owner).withdrawUnclaimed(owner.address)
            ).to.be.revertedWith("Pausable: not paused");
            await expect(
                await auctionContract.connect(owner).pause()
            ).to.emit(auctionContract,"Paused").withArgs(owner.address);
            await expect(await auctionContract.connect(owner).withdrawUnclaimed(owner.address));
        });
        it("should not allow others to withdraw unclaimed eth", async function () {
            await expect(
                await auctionContract.connect(owner).pause()
            ).to.emit(auctionContract,"Paused").withArgs(owner.address);
            await expect(
                auctionContract.connect(other).withdrawUnclaimed(other.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});
