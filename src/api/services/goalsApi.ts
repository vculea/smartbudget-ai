import type { GoalsApi } from "../contracts";
import { http } from "../http";
import type { Goal } from "../../types";

export const httpGoalsApi: GoalsApi = {
  async list() {
    const { data } = await http.get<Goal[]>("/goals");
    return data;
  },
  async create(input) {
    const { data } = await http.post<Goal>("/goals", input);
    return data;
  },
  async contribute(id, input) {
    const { data } = await http.post<Goal>(`/goals/${id}/contributions`, input);
    return data;
  },
};
