// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./NFT.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Royalties/RoyaltySplitter.sol";

contract NFTRoyaltySplitter is NFT {
    RoyaltySplitter private immutable _royaltySplitterImp;

    constructor(
        string memory name,
        string memory symbol,
        address auction,
        address projectTreasury
    ) NFT(name, symbol, auction, projectTreasury) {
        _royaltySplitterImp = new RoyaltySplitter();
        _royaltySplitterImp.initialize(projectTreasury, projectTreasury);
    }

    function mintNFT(
        address author,
        string memory nftURI,
        bytes32 hash,
        uint256 royaltyValue,
        bool setApprove
    ) external override onlyRole(MINTER_ROLE) returns (uint256) {
        uint256 id = mint(author, nftURI, hash, royaltyValue, setApprove);
        address royaltyAddr = Clones.clone(address(_royaltySplitterImp));
        RoyaltySplitter(payable(royaltyAddr)).initialize(
            author,
            _projectTreasury
        );
        _setTokenRoyalty(id, royaltyAddr, royaltyValue);

        return id;
    }
}
