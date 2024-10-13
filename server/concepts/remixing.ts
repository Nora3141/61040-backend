import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

export interface RemixDoc extends BaseDoc {
  originalPost: ObjectId;
  remixedPost: ObjectId;
}

export default class RemixingConcept {
  public readonly remixes: DocCollection<RemixDoc>;

  constructor(collectionName: string) {
    this.remixes = new DocCollection<RemixDoc>(collectionName);
  }

  async getRemixesOnPost(originalPostID: ObjectId) {
    const remixDocs = await this.remixes.readMany({ originalPost: originalPostID });
    const result = [];
    for (let i = 0; i < remixDocs.length; i++) {
      result.push(remixDocs[i].remixedPost);
    }
    return result;
  }

  async createRemix(originalPostID: ObjectId, newPostId: ObjectId) {
    // first make sure this post doesn't already exist as a different remix
    const allRemixes = await this.remixes.readMany({}, { sort: { _id: -1 } });
    for (let i = 0; i < allRemixes.length; i++) {
      const currentRemix = allRemixes[i];
      if (currentRemix.remixedPost == newPostId) {
        throw new Error("Cannot create this post as a remix, it already exists as a remixed post.");
      }
    }
    await this.remixes.createOne({ originalPost: originalPostID, remixedPost: newPostId });
  }

  async deleteRemix(toDeletePostID: ObjectId) {
    await this.remixes.deleteMany({ originalPost: toDeletePostID });
    await this.remixes.deleteMany({ remixedPost: toDeletePostID });
    return { msg: "Remix successfully deleted" };
  }

  async getMostRemixed(postIDs: ObjectId[], numToGet: number) {
    console.log("get most remixed called on: ", postIDs);
    if (postIDs.length <= numToGet) return postIDs;

    console.log("mapping...");
    const mapped = await Promise.all(
      postIDs.map(async (id: ObjectId) => {
        const remixesOfPost = await this.remixes.readMany({ originalPost: id });
        return { count: remixesOfPost.length, id };
      }),
    );
    console.log("mapped: ", mapped);

    mapped.sort((a, b) => b.count - a.count);

    const result = [];
    for (let i = 0; i < numToGet && i < mapped.length; i++) {
      result.push(mapped[i].id);
    }
    return result;
  }

  async getOriginalPost(postID: ObjectId) {
    const foundDoc = await this.remixes.readOne({ remixedPost: postID });
    if (!foundDoc) return;
    return foundDoc.originalPost;
  }
}
