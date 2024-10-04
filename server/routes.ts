import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Favoriting, Filtering, Friending, Posting, Sessioning } from "./app";
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

  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, content, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, options);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
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

  @Router.get("/favoriting/getFavorites/:username")
  async getFavoritesByUser(username: string) {
    const userID = (await Authing.getUserByUsername(username))._id;
    return await Favoriting.getFavoritedByUser(userID);
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

  // Searching Routes

  @Router.get("/searching/query/:query")
  async searchQuery(query: string) {
    // use searching concept to call a function to get post ids from this query
    // use posting concept to get the posts from these post ids
  }

  // Remixing Routes

  @Router.get("/remixing/getRemixes/:postID")
  async getPostRemixes(postID: ObjectId) {
    // assert postID is an existing post (using posting concept)
    // use remixing concept to get postIDs of remixes from the request on this original postID
    // use posting concept to get the posts from these ids
  }

  @Router.get("/remixing/createRemix/:postID")
  async createRemix(originalPostID: ObjectId, newPostID: ObjectId) {
    // assert that both posts exist (using posting concept)
    // assert that logged in (using authenticating concept)
    // use remixing concept to attatch the newPostID to the original postID
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
