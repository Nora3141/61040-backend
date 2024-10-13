import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Favoriting, Filtering, Friending, Posting, Remixing, Sessioning } from "./app";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    return await Authing.create(username, password);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Authing.updateUsername(user, username);
  }

  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Authing.updatePassword(user, currentPassword, newPassword);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Authing.delete(user);
  }

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      posts = await Posting.getByAuthor(id);
    } else {
      posts = await Posting.getPosts();
    }
    return Responses.posts(posts);
  }

  @Router.get("/posts/:title")
  async searchPosts(title: string) {
    const searchingByTitle = await Posting.getByTitle(title);
    return Responses.posts(searchingByTitle);
  }

  @Router.post("/posts")
  async createPost(session: SessionDoc, videoURL: string, videoTitle: string, videoDescription: string, originalArtist?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, videoURL, videoTitle, videoDescription, originalArtist, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  /* For now, getting rid of update
  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, options);
  }
    */

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    await Remixing.deleteRemix(oid);
    await Filtering.deletePostStorage(oid);
    return Posting.delete(oid);
  }

  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.idsToUsernames(await Friending.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Authing.getUserByUsername(friend))._id;
    return await Friending.removeFriend(user, friendOid);
  }

  @Router.get("/friend/requests")
  async getRequests(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Responses.friendRequests(await Friending.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.sendRequest(user, toOid);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.removeRequest(user, toOid);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.acceptRequest(fromOid, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.rejectRequest(fromOid, user);
  }

  // Favoriting Routes

  @Router.get("/favoriting/getFavorites/:userID")
  async getFavoritesByUser(userID: string) {
    const actualID = new ObjectId(userID);
    const favoritedIDs = await Favoriting.getFavoritedByUser(actualID);
    const result = await Posting.getByID(favoritedIDs);
    return result;
  }

  @Router.post("/favoriting/toggleFavorite/:postID")
  async toggleFavorite(postID: string, session: SessionDoc) {
    Sessioning.isLoggedIn(session);
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);

    const user = Sessioning.getUser(session);
    const result = await Favoriting.toggleFavorite(user, oid);
    return { msg: "Toggled Favorite: " + result };
  }

  @Router.get("/favoriting/favoriteCount/:postID")
  async getFavoriteCount(postID: string) {
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    const result = await Favoriting.getFavoriteCount(oid);
    return { msg: "Favorite Count: " + result };
  }

  @Router.get("/favoriting/getTrendingFavorited/:numPosts")
  async getTrendingFavorited(numPosts: number) {
    // returns "numPosts" number of recent posts that are getting the most favorites
    const WITHIN_NUM_DAYS = 3;
    const recent_posts = await Posting.getRecentPosts(WITHIN_NUM_DAYS);
    const oids = [];
    for (let i = 0; i < recent_posts.length; i++) {
      oids.push(recent_posts[i]._id);
    }
    const result = await Favoriting.getMostFavorited(oids, numPosts);

    if (!result) throw new Error("Could not get posts for found trending favorited posts.");
    const resultAsPosts = await Posting.getByID(result);

    return Responses.posts(resultAsPosts);
  }

  // Filtering Routes

  @Router.get("/filtering/getTags/:postID")
  async getTagsOnPost(postID: string) {
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    return await Filtering.getTagsOnPost(oid);
  }

  @Router.post("/filtering/addTag/:postID")
  async addTagToPost(postID: string, tagName: string) {
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    return await Filtering.addTag(oid, tagName);
  }

  @Router.post("/filtering/removeTag/:postID")
  async removeTagFromPost(postID: string, tagName: string) {
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    return await Filtering.removeTag(oid, tagName);
  }

  @Router.get("/filtering/getPostsByTag")
  async getPostsByTag(tagNames: string) {
    return await Filtering.getPostsByTags(tagNames);
  }

  @Router.get("/filtering/getRandomPostFiltered")
  async getRandomPostFiltered(tagNames: string) {
    let allPosts = [];
    if (tagNames == null) {
      allPosts = await Posting.getPosts();
    } else {
      const allPostIDs = await Filtering.getPostsByTags(tagNames);
      if (allPostIDs.length == 0) {
        return [];
      }
      allPosts = await Posting.getByID(allPostIDs);
    }
    const randomIdx = Math.floor(Math.random() * allPosts.length);
    return Responses.posts([allPosts[randomIdx]]);
  }

  // Remixing Routes

  @Router.get("/remixing/getRemixes/:postID")
  async getPostRemixes(postID: string) {
    // assert postID is an existing post (using posting concept)
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    // use remixing concept to get postIDs of remixes from the request on this original postID
    const remixes = await Remixing.getRemixesOnPost(oid);
    // use posting concept to get the posts from these ids
    const result = await Posting.getByID(remixes);
    return Responses.posts(result);
  }

  @Router.get("/remixing/getNumRemixed/:postID")
  async getNumRemixes(postID: string) {
    // assert postID is an existing post (using posting concept)
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    // use remixing concept to get postIDs of remixes from the request on this original postID
    const remixes = await Remixing.getRemixesOnPost(oid);
    return remixes.length;
  }

  @Router.post("/remixing/createRemix")
  async createRemix(originalPostID: string, session: SessionDoc, videoURL: string, videoTitle: string, videoDescription: string, originalArtist?: string, options?: PostOptions) {
    // assert that the original post exists
    const oid = new ObjectId(originalPostID);
    Posting.assertPostExists(oid);
    const originalPost = (await Posting.getByID([oid]))[0];
    const foundArtist = originalPost.originalArtist;
    // assert that the user is logged in
    Sessioning.isLoggedIn(session);
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, videoURL, videoTitle, videoDescription, foundArtist, options);
    if (!created.post) throw new Error("Could not create post as a remix.");
    await Remixing.createRemix(new ObjectId(originalPostID), created.post._id);
    return { msg: "Created as a remix: " + created.msg, post: await Responses.post(created.post) };
  }

  @Router.get("/remixing/getTrendingRemixed/:numPosts")
  async getTrendingRemixed(numPosts: number) {
    console.log("getting trending remixed posts...");
    // returns "numPosts" number of recent posts that are getting the most remixes
    const WITHIN_NUM_DAYS = 3;
    const recent_posts = await Posting.getRecentPosts(WITHIN_NUM_DAYS);
    console.log("got recent posts");
    const oids = [];
    for (let i = 0; i < recent_posts.length; i++) {
      oids.push(recent_posts[i]._id);
    }
    console.log("getting remixes on posts...");
    const result = await Remixing.getMostRemixed(oids, numPosts);
    console.log("done!");

    if (!result) throw new Error("Could not get remixes for found trending remixed posts.");
    const resultAsPosts = await Posting.getByID(result);

    return Responses.posts(resultAsPosts);
  }

  @Router.get("/remixing/getOriginalPost/:postID")
  async getOriginalPost(postID: string) {
    // given some post id, returns the original post if it is a remix, or null if it's not a remix
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    const resultID = await Remixing.getOriginalPost(oid);
    if (!resultID) return { msg: "Could not get the original post, either this post is not a remix, or the original post was deleted.", post: null };
    const postResult = await Posting.getByID([resultID]);
    return { msg: "Found original post.", post: Responses.posts(postResult) };
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
