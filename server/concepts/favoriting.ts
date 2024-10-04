import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

export interface FavoriteDoc extends BaseDoc {
  user: ObjectId; // user id
  favoritedPost: ObjectId; // post id
}

export default class FavoritingConcept {
  public readonly favorites: DocCollection<FavoriteDoc>;
  constructor(collectionName: string) {
    this.favorites = new DocCollection<FavoriteDoc>(collectionName);
  }

  async toggleFavorite(userID: ObjectId, postID: ObjectId) {
    // check if favorited already
    const favorite = await this.favorites.readOne({ user: userID, favoritedPost: postID });
    if (favorite == null) {
      await this.favorites.createOne({ user: userID, favoritedPost: postID });
      return "favorited";
    } else {
      await this.favorites.deleteOne({ favoritedPost: postID });
      return "unfavorited";
    }
  }

  async getFavoritedByUser(userID: ObjectId) {
    const favs = await this.favorites.readMany({ user: userID });
    const result: Array<ObjectId> = [];
    favs.forEach((favorite) => {
      result.push(favorite.favoritedPost);
    });
    return favs;
  }

  async getFavoriteCount(postID: ObjectId) {
    const favs = await this.favorites.readMany({ favoritedPost: postID });
    return favs.length;
  }
}
