import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Token {
  owner: string;
  metadataUri: string;
  productHash: Buffer;
  description: string;
  origin: string;
  mintedAt: number;
  royaltyRecipient: string;
  royaltyPercent: number;
}

interface MintRecord {
  minter: string;
  timestamp: number;
  metadataUri: string;
}

interface ContractState {
  lastTokenId: number;
  contractPaused: boolean;
  metadataFrozen: boolean;
  platformFee: number;
  tokens: Map<number, Token>;
  tokenCount: Map<string, number>;
  mintRecords: Map<number, MintRecord>;
}

// Mock contract implementation
class NFTMintMock {
  private state: ContractState = {
    lastTokenId: 0,
    contractPaused: false,
    metadataFrozen: false,
    platformFee: 100,
    tokens: new Map(),
    tokenCount: new Map(),
    mintRecords: new Map(),
  };

  private CONTRACT_OWNER = "deployer";
  private MAX_METADATA_LEN = 256;
  private MAX_DESCRIPTION_LEN = 1000;
  private MAX_ROYALTY_PERCENT = 10000;
  private ERR_UNAUTHORIZED = 200;
  private ERR_INVALID_METADATA = 201;
  private ERR_ALREADY_MINTED = 202;
  private ERR_INVALID_TOKEN_ID = 203;
  private ERR_INVALID_ROYALTY = 204;
  private ERR_CONTRACT_PAUSED = 205;
  private ERR_NOT_OWNER = 206;
  private ERR_INVALID_RECIPIENT = 207;
  private ERR_METADATA_FROZEN = 208;

  transfer(tokenId: number, sender: string, recipient: string): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_CONTRACT_PAUSED };
    }
    const token = this.state.tokens.get(tokenId);
    if (!token) {
      return { ok: false, value: this.ERR_INVALID_TOKEN_ID };
    }
    if (token.owner !== sender) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (recipient === this.CONTRACT_OWNER) {
      return { ok: false, value: this.ERR_INVALID_RECIPIENT };
    }
    token.owner = recipient;
    this.state.tokens.set(tokenId, token);
    this.updateTokenCount(sender, -1);
    this.updateTokenCount(recipient, 1);
    return { ok: true, value: true };
  }

  mint(
    caller: string,
    metadataUri: string,
    productHash: Buffer,
    description: string,
    origin: string,
    royaltyRecipient: string,
    royaltyPercent: number
  ): ClarityResponse<number> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_CONTRACT_PAUSED };
    }
    if (metadataUri.length > this.MAX_METADATA_LEN || description.length > this.MAX_DESCRIPTION_LEN) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    if (royaltyPercent > this.MAX_ROYALTY_PERCENT) {
      return { ok: false, value: this.ERR_INVALID_ROYALTY };
    }
    if (productHash.length > 32) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    const newTokenId = this.state.lastTokenId + 1;
    if (this.state.tokens.has(newTokenId)) {
      return { ok: false, value: this.ERR_ALREADY_MINTED };
    }
    this.state.tokens.set(newTokenId, {
      owner: caller,
      metadataUri,
      productHash,
      description,
      origin,
      mintedAt: Date.now(),
      royaltyRecipient,
      royaltyPercent,
    });
    this.state.mintRecords.set(newTokenId, {
      minter: caller,
      timestamp: Date.now(),
      metadataUri,
    });
    this.updateTokenCount(caller, 1);
    this.state.lastTokenId = newTokenId;
    return { ok: true, value: newTokenId };
  }

  burn(caller: string, tokenId: number): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_CONTRACT_PAUSED };
    }
    const token = this.state.tokens.get(tokenId);
    if (!token) {
      return { ok: false, value: this.ERR_INVALID_TOKEN_ID };
    }
    if (token.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    this.state.tokens.delete(tokenId);
    this.state.mintRecords.delete(tokenId);
    this.updateTokenCount(caller, -1);
    return { ok: true, value: true };
  }

  updateMetadata(caller: string, tokenId: number, metadataUri: string, description: string): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_CONTRACT_PAUSED };
    }
    if (this.state.metadataFrozen) {
      return { ok: false, value: this.ERR_METADATA_FROZEN };
    }
    const token = this.state.tokens.get(tokenId);
    if (!token) {
      return { ok: false, value: this.ERR_INVALID_TOKEN_ID };
    }
    if (token.owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (metadataUri.length > this.MAX_METADATA_LEN || description.length > this.MAX_DESCRIPTION_LEN) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    token.metadataUri = metadataUri;
    token.description = description;
    this.state.tokens.set(tokenId, token);
    return { ok: true, value: true };
  }

  setContractPaused(caller: string, paused: boolean): ClarityResponse<boolean> {
    if (caller !== this.CONTRACT_OWNER) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.contractPaused = paused;
    return { ok: true, value: true };
  }

  setMetadataFrozen(caller: string, frozen: boolean): ClarityResponse<boolean> {
    if (caller !== this.CONTRACT_OWNER) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.metadataFrozen = frozen;
    return { ok: true, value: true };
  }

  setPlatformFee(caller: string, fee: number): ClarityResponse<boolean> {
    if (caller !== this.CONTRACT_OWNER) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (fee > this.MAX_ROYALTY_PERCENT) {
      return { ok: false, value: this.ERR_INVALID_ROYALTY };
    }
    this.state.platformFee = fee;
    return { ok: true, value: true };
  }

  getLastTokenId(): ClarityResponse<number> {
    return { ok: true, value: this.state.lastTokenId };
  }

  getTokenUri(tokenId: number): ClarityResponse<string | number> {
    const token = this.state.tokens.get(tokenId);
    if (!token) {
      return { ok: false, value: this.ERR_INVALID_TOKEN_ID };
    }
    return { ok: true, value: token.metadataUri };
  }

  getOwner(tokenId: number): ClarityResponse<string | null | number> {
    const token = this.state.tokens.get(tokenId);
    if (!token) {
      return { ok: false, value: this.ERR_INVALID_TOKEN_ID };
    }
    return { ok: true, value: token.owner };
  }

  getTokenDetails(tokenId: number): ClarityResponse<Token | null> {
    return { ok: true, value: this.state.tokens.get(tokenId) ?? null };
  }

  getMintRecord(tokenId: number): ClarityResponse<MintRecord | null> {
    return { ok: true, value: this.state.mintRecords.get(tokenId) ?? null };
  }

  getTokenCount(owner: string): ClarityResponse<number> {
    return { ok: true, value: this.state.tokenCount.get(owner) ?? 0 };
  }

  getPlatformFee(): ClarityResponse<number> {
    return { ok: true, value: this.state.platformFee };
  }

  isContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.contractPaused };
  }

  isMetadataFrozen(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.metadataFrozen };
  }

  private updateTokenCount(owner: string, delta: number): void {
    const currentCount = this.state.tokenCount.get(owner) ?? 0;
    this.state.tokenCount.set(owner, currentCount + delta);
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  artisan: "wallet_1",
  buyer: "wallet_2",
  invalid: "wallet_3",
};

describe("NFTMint Contract", () => {
  let contract: NFTMintMock;

  beforeEach(() => {
    contract = new NFTMintMock();
    vi.resetAllMocks();
  });

  it("should initialize with correct state", () => {
    expect(contract.getLastTokenId()).toEqual({ ok: true, value: 0 });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
    expect(contract.isMetadataFrozen()).toEqual({ ok: true, value: false });
    expect(contract.getPlatformFee()).toEqual({ ok: true, value: 100 });
  });

  it("should allow artisan to mint NFT", () => {
    const productHash = Buffer.alloc(32, 0);
    const mintResult = contract.mint(
      accounts.artisan,
      "ipfs://metadata",
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      1000
    );
    expect(mintResult).toEqual({ ok: true, value: 1 });
    expect(contract.getTokenCount(accounts.artisan)).toEqual({ ok: true, value: 1 });
    const tokenDetails = contract.getTokenDetails(1);
    expect(tokenDetails).toEqual({
      ok: true,
      value: expect.objectContaining({
        owner: accounts.artisan,
        metadataUri: "ipfs://metadata",
        description: "Handcrafted pottery",
        origin: "Kenya",
        royaltyRecipient: accounts.artisan,
        royaltyPercent: 1000,
      }),
    });
    const mintRecord = contract.getMintRecord(1);
    expect(mintRecord).toEqual({
      ok: true,
      value: expect.objectContaining({
        minter: accounts.artisan,
        metadataUri: "ipfs://metadata",
      }),
    });
  });

  it("should prevent minting with invalid metadata", () => {
    const productHash = Buffer.alloc(32, 0);
    const longMetadata = "a".repeat(257);
    const mintResult = contract.mint(
      accounts.artisan,
      longMetadata,
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      1000
    );
    expect(mintResult).toEqual({ ok: false, value: 201 });
  });

  it("should prevent minting with invalid royalty", () => {
    const productHash = Buffer.alloc(32, 0);
    const mintResult = contract.mint(
      accounts.artisan,
      "ipfs://metadata",
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      10001
    );
    expect(mintResult).toEqual({ ok: false, value: 204 });
  });

  it("should allow token transfer", () => {
    const productHash = Buffer.alloc(32, 0);
    contract.mint(
      accounts.artisan,
      "ipfs://metadata",
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      1000
    );
    const transferResult = contract.transfer(1, accounts.artisan, accounts.buyer);
    expect(transferResult).toEqual({ ok: true, value: true });
    expect(contract.getOwner(1)).toEqual({ ok: true, value: accounts.buyer });
    expect(contract.getTokenCount(accounts.artisan)).toEqual({ ok: true, value: 0 });
    expect(contract.getTokenCount(accounts.buyer)).toEqual({ ok: true, value: 1 });
  });

  it("should prevent transfer by non-owner", () => {
    const productHash = Buffer.alloc(32, 0);
    contract.mint(
      accounts.artisan,
      "ipfs://metadata",
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      1000
    );
    const transferResult = contract.transfer(1, accounts.buyer, accounts.invalid);
    expect(transferResult).toEqual({ ok: false, value: 206 });
  });

  it("should prevent transfer to contract owner", () => {
    const productHash = Buffer.alloc(32, 0);
    contract.mint(
      accounts.artisan,
      "ipfs://metadata",
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      1000
    );
    const transferResult = contract.transfer(1, accounts.artisan, accounts.deployer);
    expect(transferResult).toEqual({ ok: false, value: 207 });
  });

  it("should allow burning token", () => {
    const productHash = Buffer.alloc(32, 0);
    contract.mint(
      accounts.artisan,
      "ipfs://metadata",
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      1000
    );
    const burnResult = contract.burn(accounts.artisan, 1);
    expect(burnResult).toEqual({ ok: true, value: true });
    expect(contract.getTokenDetails(1)).toEqual({ ok: true, value: null });
    expect(contract.getTokenCount(accounts.artisan)).toEqual({ ok: true, value: 0 });
  });

  it("should prevent burning by non-owner", () => {
    const productHash = Buffer.alloc(32, 0);
    contract.mint(
      accounts.artisan,
      "ipfs://metadata",
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      1000
    );
    const burnResult = contract.burn(accounts.buyer, 1);
    expect(burnResult).toEqual({ ok: false, value: 206 });
  });

  it("should allow updating metadata", () => {
    const productHash = Buffer.alloc(32, 0);
    contract.mint(
      accounts.artisan,
      "ipfs://metadata",
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      1000
    );
    const updateResult = contract.updateMetadata(accounts.artisan, 1, "ipfs://new-metadata", "Updated pottery");
    expect(updateResult).toEqual({ ok: true, value: true });
    const tokenDetails = contract.getTokenDetails(1);
    expect(tokenDetails).toEqual({
      ok: true,
      value: expect.objectContaining({
        metadataUri: "ipfs://new-metadata",
        description: "Updated pottery",
      }),
    });
  });

  it("should prevent updating metadata when frozen", () => {
    const productHash = Buffer.alloc(32, 0);
    contract.mint(
      accounts.artisan,
      "ipfs://metadata",
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      1000
    );
    contract.setMetadataFrozen(accounts.deployer, true);
    const updateResult = contract.updateMetadata(accounts.artisan, 1, "ipfs://new-metadata", "Updated pottery");
    expect(updateResult).toEqual({ ok: false, value: 208 });
  });

  it("should allow admin to pause contract", () => {
    const pauseResult = contract.setContractPaused(accounts.deployer, true);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: true });

    const productHash = Buffer.alloc(32, 0);
    const mintResult = contract.mint(
      accounts.artisan,
      "ipfs://metadata",
      productHash,
      "Handcrafted pottery",
      "Kenya",
      accounts.artisan,
      1000
    );
    expect(mintResult).toEqual({ ok: false, value: 205 });
  });

  it("should prevent non-admin from pausing contract", () => {
    const pauseResult = contract.setContractPaused(accounts.artisan, true);
    expect(pauseResult).toEqual({ ok: false, value: 200 });
  });

  it("should allow admin to set platform fee", () => {
    const setFeeResult = contract.setPlatformFee(accounts.deployer, 200);
    expect(setFeeResult).toEqual({ ok: true, value: true });
    expect(contract.getPlatformFee()).toEqual({ ok: true, value: 200 });
  });

  it("should prevent invalid platform fee", () => {
    const setFeeResult = contract.setPlatformFee(accounts.deployer, 10001);
    expect(setFeeResult).toEqual({ ok: false, value: 204 });
  });
});