require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();
require("hardhat-tracer");

const COINAPI = process.env.COINAPI;

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.15',
        settings: {
          optimizer: {
            enabled: true,
            runs: 500,
          },
        },
      },
    ],
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    // gasPriceApi: "https://api.snowtrace.io/api?module=proxy&action=eth_gasPrice",
    // token: "AVAX",
    coinmarketcap: COINAPI,
  },
};
