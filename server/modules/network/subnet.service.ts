import {
  calculateSubnetInfo,
  parseMaskInput,
} from "../../../shared/network/subnet.js";

class SubnetService {
  inspect(networkAddress: string, mask: string) {
    const maskBits = parseMaskInput(mask);
    return calculateSubnetInfo(networkAddress, maskBits);
  }
}

export const subnetService = new SubnetService();
