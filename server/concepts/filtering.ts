import { IntegerType, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

export interface FilterDoc extends BaseDoc {
  postID: ObjectId;
  tags: Array<IntegerType>;
}

export default class FilteringConcept {
  public readonly filters: DocCollection<FilterDoc>;
  public readonly ALL_TAGS = ["tag1", "tag2", "tag3"];

  constructor(collectionName: string) {
    this.filters = new DocCollection<FilterDoc>(collectionName);
  }

  async addTag(postID: ObjectId, tagName: string) {
    const filter = await this.filters.readOne({ postID: postID });
    const tagNameIdx = this.ALL_TAGS.indexOf(tagName);
    if (tagNameIdx == -1) {
      throw new Error("This tag name is not allowed, must be one of the pre-set tag names.");
    }
    if (!filter) {
      await this.filters.createOne({ postID: postID, tags: [tagNameIdx] });
    } else {
      const prev_list = filter.tags;
      if (prev_list.includes(tagNameIdx)) {
        throw new Error("This tag already exists on this post.");
      }
      prev_list.push(tagNameIdx);
      const filterID = filter._id;
      await this.filters.partialUpdateOne({ _id: filterID }, { tags: prev_list });
    }
    return { msg: "Tag successfully added!" };
  }

  async removeTag(postID: ObjectId, tagName: string) {
    const filter = await this.filters.readOne({ postID: postID });
    const tagNameIdx = this.ALL_TAGS.indexOf(tagName);
    if (tagNameIdx == -1) throw new Error("This tag does not exist on this post.");
    if (!filter || !filter.tags.includes(tagNameIdx)) throw new Error("This tag does not exist on this post.");
    else {
      const newArray = filter.tags.filter((e, i) => e !== tagNameIdx);
      const _id = filter._id;
      await this.filters.partialUpdateOne({ _id }, { postID: postID, tags: newArray });
    }
    return "Tag successfully removed!";
  }

  async getTagsOnPost(postID: ObjectId) {
    const filter = await this.filters.readOne({ postID: postID });
    if (!filter) {
      return [];
    }
    return filter.tags;
  }

  async getPostsByTags(tagNames: string) {
    const tags = tagNames.replace(/\s+/g, "").split(",");
    let filtered = await this.filters.readMany({});
    for (let i = 0; i < tags.length; i++) {
      const newFiltered: FilterDoc[] = [];
      const tagName = tags[i];
      const idx = this.ALL_TAGS.indexOf(tagName);
      filtered.forEach((entry) => {
        if (entry.tags.includes(idx)) newFiltered.push(entry);
      });
      filtered = newFiltered;
    }

    const postIDs: Array<ObjectId> = [];
    filtered.forEach((entry) => {
      postIDs.push(entry.postID);
    });
    return postIDs;
  }
}
