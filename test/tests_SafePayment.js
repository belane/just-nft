const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");


describe("SafePayment", function () {
    let owner, alice, bob, ethValue, safePayment;

    beforeEach(async () => {
        [owner, alice, bob, other, ...addrs] = await ethers.getSigners();
        ethValue = parseEther((Math.random() * 100).toString());

        const SafePaymentMock = await ethers.getContractFactory("SafePaymentMock", owner);
        safePayment = await SafePaymentMock.deploy();
        await safePayment.deployed();
    });

    it("sends eth to EOA", async function () {
        await expect(await safePayment.connect(alice).sendETH(bob.address, {value: ethValue})).to.changeBalance(bob, ethValue);
    });
    it("sends eth to normal contract", async function () {
        const ReceiverGoodMock = await ethers.getContractFactory("ReceiverGoodMock", owner);
        receiverGood = await ReceiverGoodMock.deploy();
        await receiverGood.deployed();

        await expect(await safePayment.connect(alice).sendETH(receiverGood.address, {value: ethValue})).to.changeBalance(receiverGood, ethValue);
    });
    it("keeps eth for no fallback contract", async function () {
        const ReceiverNoFallbackMock = await ethers.getContractFactory("ReceiverNoFallbackMock", owner);
        receiverNoFallback = await ReceiverNoFallbackMock.deploy();
        await receiverNoFallback.deployed();

        await expect(await safePayment.connect(alice).sendETH(receiverNoFallback.address, {value: ethValue}))
            .to.emit(safePayment, "FailedPayment")
            .withArgs(receiverNoFallback.address, ethValue);
        expect(await ethers.provider.getBalance(safePayment.address)).to.equal(ethValue);
    });
    it("keeps eth for revert contract", async function () {
        const ReceiverRevertMock = await ethers.getContractFactory("ReceiverRevertMock", owner);
        receiverRevert = await ReceiverRevertMock.deploy();
        await receiverRevert.deployed();

        await expect(await safePayment.connect(alice).sendETH(receiverRevert.address, {value: ethValue}))
            .to.emit(safePayment, "FailedPayment")
            .withArgs(receiverRevert.address, ethValue);
        expect(await ethers.provider.getBalance(safePayment.address)).to.equal(ethValue);
    });
    it("keeps eth for high gas contract", async function () {
        const ReceiverHighGasMock = await ethers.getContractFactory("ReceiverHighGasMock", owner);
        receiverHighGas = await ReceiverHighGasMock.deploy();
        await receiverHighGas.deployed();

        await expect(await safePayment.connect(alice).sendETH(receiverHighGas.address, {value: ethValue}))
            .to.emit(safePayment, "FailedPayment")
            .withArgs(receiverHighGas.address, ethValue);
        expect(await ethers.provider.getBalance(safePayment.address)).to.equal(ethValue);
    });
    it("allows to get eth from failed transfers", async function () {
        const ReceiverNoFallbackMock = await ethers.getContractFactory("ReceiverNoFallbackMock", owner);
        receiverNoFallback = await ReceiverNoFallbackMock.deploy();
        await receiverNoFallback.deployed();

        await expect(await safePayment.connect(alice).sendETH(receiverNoFallback.address, {value: ethValue}))
            .to.emit(safePayment, "FailedPayment")
            .withArgs(receiverNoFallback.address, ethValue);
        expect(await ethers.provider.getBalance(safePayment.address)).to.equal(ethValue);

        await expect(await safePayment.withdraw(bob.address)).to.changeBalance(bob, ethValue);
        expect(await ethers.provider.getBalance(safePayment.address)).to.equal(0);
    });
    it("should only allow to get eth from failed transfers", async function () {
        const ReceiverNoFallbackMock = await ethers.getContractFactory("ReceiverNoFallbackMock", owner);
        receiverNoFallback = await ReceiverNoFallbackMock.deploy();
        await receiverNoFallback.deployed();

        expect(await owner.sendTransaction({to: safePayment.address, value: ethValue}))
            .to.changeBalance(safePayment, ethValue);
        await expect(await safePayment.connect(alice).sendETH(receiverNoFallback.address, {value: ethValue}))
            .to.emit(safePayment, "FailedPayment")
            .withArgs(receiverNoFallback.address, ethValue);

        await expect(await safePayment.withdraw(bob.address)).to.changeBalance(bob, ethValue);
        expect(await ethers.provider.getBalance(safePayment.address)).to.equal(ethValue);
    });
    it("should keeps eth and don't reset _unclaimed for failed claims", async function () {
        const ReceiverNoFallbackMock = await ethers.getContractFactory("ReceiverNoFallbackMock", owner);
        receiverNoFallback = await ReceiverNoFallbackMock.deploy();
        await receiverNoFallback.deployed();

        await expect(await safePayment.connect(alice).sendETH(receiverNoFallback.address, {value: ethValue}))
            .to.emit(safePayment, "FailedPayment")
            .withArgs(receiverNoFallback.address, ethValue);
        expect(await ethers.provider.getBalance(safePayment.address)).to.equal(ethValue);
        await expect(await safePayment.callStatic.withdraw(receiverNoFallback.address)).to.be.false;
        await expect(await safePayment.withdraw(receiverNoFallback.address)).to.not.changeBalance(receiverNoFallback, ethValue);
        expect(await ethers.provider.getBalance(safePayment.address)).to.equal(ethValue);
        await expect(await safePayment.withdraw(bob.address)).to.changeBalance(bob, ethValue);
        expect(await ethers.provider.getBalance(safePayment.address)).to.equal(0);
    });
    it("is non reentrant", async function () {
        const ReceiverReentrantMock = await ethers.getContractFactory("ReceiverReentrantMock", owner);
        receiverReentrant = await ReceiverReentrantMock.deploy(bob.address);
        await receiverReentrant.deployed();

        await expect(await safePayment.connect(alice).callStatic.sendETH(receiverReentrant.address, {value: ethValue}))
        await expect(await safePayment.connect(alice).sendETH(receiverReentrant.address, {value: ethValue}))
            .to.emit(safePayment, "FailedPayment")
            .withArgs(receiverReentrant.address, ethValue);

        expect(await ethers.provider.getBalance(safePayment.address)).to.equal(ethValue);
    });
});
