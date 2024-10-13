import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface PostOptions {
  backgroundColor?: string;
}

export interface PostDoc extends BaseDoc {
  author: ObjectId;
  videoURL: string;
  videoTitle: string;
  videoDescription: string;
  originalArtist?: string;
  options?: PostOptions;
}

/**
 * concept: Posting [Author]
 */
export default class PostingConcept {
  public readonly posts: DocCollection<PostDoc>;

  /**
   * Make an instance of Posting.
   */
  constructor(collectionName: string) {
    this.posts = new DocCollection<PostDoc>(collectionName);
  }

  async create(author: ObjectId, videoURL: string, videoTitle: string, videoDescription: string, originalArtist?: string, options?: PostOptions) {
    const _id = await this.posts.createOne({ author, videoURL, videoTitle, videoDescription, originalArtist, options });
    return { msg: "Post successfully created!", post: await this.posts.readOne({ _id }) };
  }

  async getPosts() {
    // Returns all posts! You might want to page for better client performance
    return await this.posts.readMany({}, { sort: { _id: -1 } });
  }

  async getRecentPosts(numDays: number) {
    // Returns all posts within numDays of the current date
    const currentDate = new Date();
    const all_posts = await this.posts.readMany({}, { sort: { _id: -1 } });
    const filtered_posts = all_posts.filter((post) => {
      const postDate = new Date(post.dateCreated);
      const diffTime = Math.abs(currentDate.getTime() - postDate.getTime());
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays <= numDays;
    });
    return filtered_posts;
  }

  async getByAuthor(author: ObjectId) {
    return await this.posts.readMany({ author });
  }

  async getByTitle(title: string) {
    const regex = new RegExp(`^${title}`, "i");
    return await this.posts.readMany({ videoTitle: { $regex: regex } });
  }

  async getByID(postIDs: ObjectId[]) {
    const result: PostDoc[] = [];
    for (let i = 0; i < postIDs.length; i++) {
      const post = await this.posts.readOne({ _id: postIDs[i] });
      if (post == null) {
        throw new Error("Post ID not found.");
      }
      result.push(post);
    }
    return result;
  }

  /** For now, not including update
  async update(_id: ObjectId, content?: string, options?: PostOptions) {
    // Note that if content or options is undefined, those fields will *not* be updated
    // since undefined values for partialUpdateOne are ignored.
    await this.posts.partialUpdateOne({ _id }, { content, options });
    return { msg: "Post successfully updated!" };
  }
    */

  async delete(_id: ObjectId) {
    await this.posts.deleteOne({ _id });
    return { msg: "Post deleted successfully!" };
  }

  async assertAuthorIsUser(_id: ObjectId, user: ObjectId) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
    if (post.author.toString() !== user.toString()) {
      throw new PostAuthorNotMatchError(user, _id);
    }
  }

  async assertPostExists(_id: ObjectId) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      console.log("post not found");
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
  }
}

export class PostAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly author: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of post {1}!", author, _id);
  }
}
