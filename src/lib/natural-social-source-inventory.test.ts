import { describe, expect, it } from "vitest";
import {
  buildNaturalSocialSourceInventoryRecord,
  hasStableNaturalSocialSourceInventoryKey,
  mergeNaturalSocialSourceInventories,
  naturalSocialSourceInventoryLessonKey,
  sanitizeNaturalSocialSourceInventoryForLesson,
} from "./natural-social-source-inventory";
import type { NaturalSocialSourceInventory } from "@/types/lesson";

const input = {
  subject: "Tự nhiên và Xã hội",
  grade: "Lớp 2",
  book: "Kết nối tri thức",
  bookVolume: "",
  lessonTitle: "Bài 17. Động vật sống ở đâu?",
  specialRequest: "",
};

describe("natural social source inventory cache helpers", () => {
  it("builds a stable lesson key only when the title is known", () => {
    expect(hasStableNaturalSocialSourceInventoryKey(input)).toBe(true);
    expect(hasStableNaturalSocialSourceInventoryKey({ lessonTitle: "Tự nhận diện" })).toBe(false);
    expect(naturalSocialSourceInventoryLessonKey(input)).toMatch(/^nsxh_[a-f0-9]{40}$/);
  });

  it("merges inventory without dropping habitat-specific fields", () => {
    const base: NaturalSocialSourceInventory = {
      visuals: [
        { visualId: "v-sea-turtle", label: "Rùa biển", page: "64", specificName: "rùa biển", habitatPlace: "biển", environmentCategory: "dưới nước" },
      ],
      questions: [
        { taskId: "q-1", question: "Con vật sống ở đâu?", expectedAnswer: "Nêu nơi sống cụ thể." },
      ],
    };
    const incoming: NaturalSocialSourceInventory = {
      visuals: [
        { visualId: "v-sea-turtle", label: "Rùa biển", expectedObservation: "Rùa biển sống ở biển." },
      ],
      classificationTasks: [
        { taskId: "c-1", label: "Phân loại theo môi trường sống", categories: ["trên cạn", "dưới nước"] },
      ],
    };

    const merged = mergeNaturalSocialSourceInventories(base, incoming);

    expect(merged?.visuals?.[0]).toMatchObject({
      visualId: "v-sea-turtle",
      page: "64",
      specificName: "rùa biển",
      habitatPlace: "biển",
      environmentCategory: "dưới nước",
      expectedObservation: "Rùa biển sống ở biển.",
    });
    expect(merged?.questions).toHaveLength(1);
    expect(merged?.classificationTasks).toHaveLength(1);
  });

  it("strips habitat fields when a school lesson is not about habitats", () => {
    const sanitized = sanitizeNaturalSocialSourceInventoryForLesson({
      ...input,
      lessonTitle: "Bài 6. Truyền thống trường em",
    }, {
      visuals: [
        {
          visualId: "v-school-history",
          label: "Lịch sử hình thành và phát triển của trường",
          specificName: "lịch sử hình thành và phát triển của trường",
          habitatPlace: "trường học",
          environmentCategory: "không gian học tập",
          expectedObservation: "HS nhận ra trường có những giai đoạn phát triển khác nhau.",
        },
      ],
    }, { primaryType: "school" });

    expect(sanitized?.visuals?.[0]).toMatchObject({
      visualId: "v-school-history",
      label: "Lịch sử hình thành và phát triển của trường",
    });
    expect(sanitized?.visuals?.[0].habitatPlace).toBeUndefined();
    expect(sanitized?.visuals?.[0].environmentCategory).toBeUndefined();
    expect(sanitized?.uncertain?.join(" ")).toContain("Đã bỏ qua trường nơi sống");
  });

  it("keeps habitat fields for plants and animals lessons", () => {
    const sanitized = sanitizeNaturalSocialSourceInventoryForLesson(input, {
      visuals: [
        { visualId: "v-sea-turtle", label: "Rùa biển", habitatPlace: "biển", environmentCategory: "dưới nước" },
      ],
    }, { primaryType: "plants-animals" });

    expect(sanitized?.visuals?.[0]).toMatchObject({
      habitatPlace: "biển",
      environmentCategory: "dưới nước",
    });
  });

  it("records component counts and source hashes only, not a full lesson", () => {
    const record = buildNaturalSocialSourceInventoryRecord(input, {
      visuals: [{ visualId: "v-1", label: "Con cá", page: "62" }],
      questions: [{ taskId: "q-1", question: "Con cá sống ở đâu?" }],
    }, ["hash-1"]);

    expect(record?.components.visuals.itemCount).toBe(1);
    expect(record?.components.questions.sourceHashes).toEqual(["hash-1"]);
    expect(record).not.toHaveProperty("lesson");
  });
});
