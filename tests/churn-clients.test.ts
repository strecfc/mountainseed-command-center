import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clientsFromSeedFile, clientFromRecord } from "@/lib/churned-clients";

const clients = clientsFromSeedFile(
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "seed", "churned_clients.json"), "utf8")),
);

describe("churned client snapshot", () => {
  it("lists 35 past depository clients, newest first, without Salesforce ids", () => {
    expect(clients).toHaveLength(35);
    expect(clients[0]).toEqual({
      name: "Goldenwest Federal Credit Union",
      closedOn: "2026-10-14",
      lastOrderOn: "2023-09-26",
      daysSinceLastOrder: 1140,
      reason: "Non Responsive",
      owner: "Cameron Bowes",
    });
    expect(clients.map((client) => client.closedOn).join(",")).toBe(
      [...clients.map((client) => client.closedOn)].sort((a, b) => (b || "").localeCompare(a || "")).join(","),
    );
    expect(JSON.stringify(clients)).not.toMatch(/001[A-Za-z0-9]{12}/);
    const nested = clientFromRecord({
      Id: "0010B00001zt0R8QAI",
      Name: "Example Bank",
      Closed_AMC_Date__c: "2026-01-02",
      Owner: { Name: "Ada Owner" },
    });
    expect(nested?.owner).toBe("Ada Owner");
    expect(nested && "Id" in nested).toBe(false);
  });
});
