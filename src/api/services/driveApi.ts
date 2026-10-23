import type { DriveApi } from "../contracts";
import { http } from "../http";

export const httpDriveApi: DriveApi = {
  async status() {
    const { data } = await http.get<{ enabled: boolean }>("/drive/status");
    return data;
  },
};
