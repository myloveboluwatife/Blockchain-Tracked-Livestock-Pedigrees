import { describe, it, expect, beforeEach } from "vitest";
import { buffCV, stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_HASH_EXISTS = 100;
const ERR_INVALID_HASH = 101;
const ERR_UNAUTHORIZED = 102;
const ERR_INVALID_BREED = 103;
const ERR_INVALID_DATE = 104;
const ERR_INACTIVE = 105;
const ERR_AUTHORITY_NOT_VERIFIED = 106;
const ERR_MAX_LIVESTOCK_EXCEEDED = 107;
const ERR_INVALID_DESCRIPTION = 108;

interface Livestock {
  breed: string;
  birthDate: number;
  description: string;
  owner: string;
  isActive: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class LivestockRegistryMock {
  state: {
    livestockCounter: number;
    maxLivestock: number;
    authorityContract: string | null;
    livestockDetails: Map<string, Livestock>;
    livestockByOwner: Map<string, string[]>;
  } = {
    livestockCounter: 0,
    maxLivestock: 10000,
    authorityContract: null,
    livestockDetails: new Map(),
    livestockByOwner: new Map(),
  };
  blockHeight: number = 100;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);

  reset() {
    this.state = {
      livestockCounter: 0,
      maxLivestock: 10000,
      authorityContract: null,
      livestockDetails: new Map(),
      livestockByOwner: new Map(),
    };
    this.blockHeight = 100;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_UNAUTHORIZED };
    if (this.state.authorityContract !== null) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  registerLivestock(hash: string, breed: string, birthDate: number, description: string): Result<number> {
    if (this.state.livestockCounter >= this.state.maxLivestock) return { ok: false, value: ERR_MAX_LIVESTOCK_EXCEEDED };
    if (!hash || hash.length === 0) return { ok: false, value: ERR_INVALID_HASH };
    if (!breed || breed.length > 50) return { ok: false, value: ERR_INVALID_BREED };
    if (birthDate > this.blockHeight) return { ok: false, value: ERR_INVALID_DATE };
    if (description.length > 200) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (this.state.livestockDetails.has(hash)) return { ok: false, value: ERR_HASH_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    const id = this.state.livestockCounter;
    this.state.livestockDetails.set(hash, { breed, birthDate, description, owner: this.caller, isActive: true });
    const ownerHashes = this.state.livestockByOwner.get(this.caller) || [];
    if (ownerHashes.length >= 100) return { ok: false, value: ERR_MAX_LIVESTOCK_EXCEEDED };
    this.state.livestockByOwner.set(this.caller, [...ownerHashes, hash]);
    this.state.livestockCounter++;
    return { ok: true, value: id };
  }

  getLivestock(hash: string): Livestock | null {
    return this.state.livestockDetails.get(hash) || null;
  }

  getLivestockByOwner(owner: string): string[] {
    return this.state.livestockByOwner.get(owner) || [];
  }

  getLivestockCount(): Result<number> {
    return { ok: true, value: this.state.livestockCounter };
  }

  isLivestockRegistered(hash: string): Result<boolean> {
    return { ok: true, value: this.state.livestockDetails.has(hash) };
  }

  updateLivestockStatus(hash: string, isActive: boolean): Result<boolean> {
    const livestock = this.state.livestockDetails.get(hash);
    if (!livestock) return { ok: false, value: ERR_HASH_EXISTS };
    if (livestock.owner !== this.caller) return { ok: false, value: ERR_UNAUTHORIZED };
    this.state.livestockDetails.set(hash, { ...livestock, isActive });
    return { ok: true, value: true };
  }

  transferLivestock(hash: string, newOwner: string): Result<boolean> {
    const livestock = this.state.livestockDetails.get(hash);
    if (!livestock) return { ok: false, value: ERR_HASH_EXISTS };
    if (livestock.owner !== this.caller) return { ok: false, value: ERR_UNAUTHORIZED };
    if (!livestock.isActive) return { ok: false, value: ERR_INACTIVE };
    if (newOwner === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_UNAUTHORIZED };
    const oldOwnerHashes = this.state.livestockByOwner.get(this.caller) || [];
    const newOwnerHashes = this.state.livestockByOwner.get(newOwner) || [];
    if (newOwnerHashes.length >= 100) return { ok: false, value: ERR_MAX_LIVESTOCK_EXCEEDED };
    this.state.livestockDetails.set(hash, { ...livestock, owner: newOwner });
    this.state.livestockByOwner.set(this.caller, oldOwnerHashes.filter(h => h !== hash));
    this.state.livestockByOwner.set(newOwner, [...newOwnerHashes, hash]);
    return { ok: true, value: true };
  }
}

describe("LivestockRegistry", () => {
  let contract: LivestockRegistryMock;

  beforeEach(() => {
    contract = new LivestockRegistryMock();
    contract.reset();
  });

  it("registers livestock successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const livestock = contract.getLivestock("hash1");
    expect(livestock).toEqual({ breed: "Angus", birthDate: 50, description: "Healthy cow", owner: "ST1TEST", isActive: true });
    expect(contract.getLivestockByOwner("ST1TEST")).toEqual(["hash1"]);
  });

  it("rejects duplicate hash", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    const result = contract.registerLivestock("hash1", "Holstein", 60, "Another cow");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_HASH_EXISTS);
  });

  it("rejects invalid hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerLivestock("", "Angus", 50, "Healthy cow");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects invalid breed", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerLivestock("hash1", "", 50, "Healthy cow");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_BREED);
  });

  it("rejects invalid birth date", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerLivestock("hash1", "Angus", 200, "Healthy cow");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DATE);
  });

  it("rejects invalid description", () => {
    contract.setAuthorityContract("ST2TEST");
    const longDesc = "a".repeat(201);
    const result = contract.registerLivestock("hash1", "Angus", 50, longDesc);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DESCRIPTION);
  });

  it("rejects registration without authority", () => {
    const result = contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("updates livestock status successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    const result = contract.updateLivestockStatus("hash1", false);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const livestock = contract.getLivestock("hash1");
    expect(livestock?.isActive).toBe(false);
  });

  it("rejects status update by non-owner", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    contract.caller = "ST2FAKE";
    const result = contract.updateLivestockStatus("hash1", false);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });

  it("transfers livestock successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    const result = contract.transferLivestock("hash1", "ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const livestock = contract.getLivestock("hash1");
    expect(livestock?.owner).toBe("ST2TEST");
    expect(contract.getLivestockByOwner("ST1TEST")).toEqual([]);
    expect(contract.getLivestockByOwner("ST2TEST")).toEqual(["hash1"]);
  });

  it("rejects transfer by non-owner", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    contract.caller = "ST2FAKE";
    const result = contract.transferLivestock("hash1", "ST3TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });

  it("rejects transfer of inactive livestock", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    contract.updateLivestockStatus("hash1", false);
    const result = contract.transferLivestock("hash1", "ST2TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INACTIVE);
  });

  it("rejects transfer to invalid principal", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    const result = contract.transferLivestock("hash1", "SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });

  it("returns correct livestock count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    contract.registerLivestock("hash2", "Holstein", 60, "Another cow");
    const result = contract.getLivestockCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks livestock existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerLivestock("hash1", "Angus", 50, "Healthy cow");
    const result = contract.isLivestockRegistered("hash1");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.isLivestockRegistered("hash2");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });
});