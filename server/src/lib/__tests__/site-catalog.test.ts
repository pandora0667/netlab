import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRecommendedNextToolPages,
  getRoutableSitePages,
} from "../../../../shared/catalog/site-catalog";

describe("site catalog integrations", () => {
  it("exposes the routing incident explorer as a routable page", () => {
    const pages = getRoutableSitePages();

    assert.ok(pages.some((page) => page.path === "/routing-incidents"));
  });

  it("recommends routing incident exploration from the engineering workbench", () => {
    const recommended = getRecommendedNextToolPages("/network-engineering");

    assert.ok(recommended.some((page: { path: string }) => page.path === "/routing-incidents"));
    assert.ok(recommended.some((page: { path: string }) => page.path === "/ipv6-transition"));
  });
});
