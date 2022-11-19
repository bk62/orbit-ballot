import { create } from "ipfs-core";
// import OrbitDB = require("orbit-db");
import OrbitDB from "orbit-db";
import type { OrbitDB as OrbitDBType } from "orbit-db";
import type { IPFS } from "ipfs";
import { multiaddr } from "@multiformats/multiaddr";
import type DocumentStore from "orbit-db-docstore";
import type KeyValueStore from "orbit-db-kvstore";
import type { IStoreOptions } from "orbit-db/DBOptions";

// indexBy is document store specific 

interface IDocumentStoreOptions extends IStoreOptions {
    indexBy?: string;
}

export type Base = {
    // metadata json IPFS CID
    metadataCid: string;
}

export type DAO = Base & {
    name: string;
}

export type Vote = Base & {
    choice: string;
    reason?: string;
}

export type Proposal = Base & {
    title: string;
    description?: string;
    votesCounter?: string;
}



export class Ballot {
    ipfsOpts: object = {
        // preload: { enabled: false },
        relay: { enabled: true, hop: { enabled: true, active: true } },
        repo: "./ipfs",
        // EXPERIMENTAL: { pubsub: true },
        // config: {
        //     Bootstrap: [],
        //     Addresses: { Swarm: [] }
        // }
    }
    pubsub_topic = "";
    peerId: any = null;

    node: IPFS | null = null;
    orbitdb: OrbitDBType | null = null;
    defaultOptions: Record<string, object> = {};

    user: KeyValueStore<unknown> | null = null
    daos: DocumentStore<DAO> | null = null;
    proposals: DocumentStore<Proposal> | null = null;
    votes: DocumentStore<Vote> | null = null;

    constructor(ipfsOpts: object = {}, pubsub_topic = "") {
        this.ipfsOpts = { ...this.ipfsOpts, ...ipfsOpts };
        this.pubsub_topic = pubsub_topic;
    }

    public async create() {
        console.log("Creating ipfs with opts");
        console.log(this.ipfsOpts);
        this.node = await create(this.ipfsOpts);
        await this._init();
    }

    protected async _init() {
        const peerInfo = await this.node!.id();
        this.peerId = peerInfo.id;
        this.orbitdb = await OrbitDB.createInstance(this.node);
        this.defaultOptions = {
            accessController: {
                write: [this.orbitdb.identity.id]
            }
        };

        const docStoreOptions: IDocumentStoreOptions = {
            ...this.defaultOptions,
            // index by IPFS CID for the associated metadata JSON (which is saved to IPFS manually before calling addVote etc)
            indexBy: "metadataCid",
        };

        this.daos = await this.orbitdb.docstore("daos", docStoreOptions);
        this.proposals = await this.orbitdb.docstore("proposals", docStoreOptions);
        this.votes = await this.orbitdb.docstore("votes", docStoreOptions);

        this.user = await this.orbitdb.kvstore("user", this.defaultOptions);
        await this.user.load()
        await this.user.set("votes", this.votes.id);

        await this.daos.load();
        await this.votes.load();
        await this.proposals.load();

        // peer connect event handler
        // this.node?.libp2p.connection.on()

        const topic = this.pubsub_topic || peerInfo.id.toString();
        console.log("subscribing to topic ", topic);
        // await this.node?.pubsub.subscribe(topic, this.handleMessageRecv.bind(this));

    }

    async connectToPeer(multiaddress: string, protocol = "/p2p-circuit/ipfs/") {
        try {
            const addr = multiaddr(protocol + multiaddr);
            await this.node?.swarm.connect(addr);
        } catch (e) {
            throw (e);
        }
    }

    handleMessageRecv(msg: unknown) {
        console.log("message recv by ", this.peerId.toString());
        console.log(msg);
    }

    async sendMessage(topic: string, msg: object) {
        try {
            const msgStr = JSON.stringify(msg);
            const msgBuf = new TextEncoder().encode(msgStr);
            await this.node?.pubsub.publish(topic, msgBuf);
        } catch (e) {
            throw (e);
        }
    }

    async addProposal(proposal: Proposal): Promise<string | null> {
        const existing = await this.getProposal(proposal.metadataCid);
        if (existing) {
            // update if proposal with same hash already exists
            return await this.updateProposal(proposal);
        }

        // create votes counter
        const dbName = "nvotes." + proposal.metadataCid.substring(20, 20);
        const counter = await this.orbitdb?.counter(dbName, this.defaultOptions);

        const cid = await this.proposals?.put({ ...proposal, votesCounter: counter?.id });
        return cid ?? null;
    }

    async getProposalVotesCount(proposal: Proposal): Promise<number | null> {
        if (proposal.votesCounter == null) {
            return null;
        }
        const counter = await this.orbitdb?.counter(proposal.votesCounter);
        await counter?.load();
        return counter?.value ?? null;
    }

    async incrProposalVotesCount(proposal: Proposal): Promise<string | null> {
        if (proposal.votesCounter == null) {
            return null;
        }
        const counter = await this.orbitdb?.counter(proposal.votesCounter);
        const cid = await counter?.inc();
        return cid ?? null;
    }

    async addVote(vote: Vote): Promise<string | null> {
        const prev = await this.getVote(vote.metadataCid);
        if (prev) {
            // update if vote with same hash already exists
            return await this.updateVote(vote);
        }

        const cid = await this.votes?.put(vote);
        // TODO
        // get vote's proposal
        // e.g. add a voteOnProposal(proposal) that calls addVote(vote)
        // or call incr count from outside the lib
        // const _ = await this.incrProposalVotesCount(proposal);

        return cid ?? null;
    }



    async getAllProposals(): Promise<Proposal[]> {
        const proposals = this.proposals?.get("");
        return proposals ?? [];
    }

    async getAllVotes(): Promise<Vote[]> {
        const votes = this.votes?.get("");
        return votes ?? [];
    }

    async getProposal(metadataCid: string) {
        if (this.proposals === null) return null;
        const proposal = this.proposals?.get(metadataCid)[0];
        return proposal;
    }

    async getVote(metadataCid: string) {
        if (this.votes === null) return null;
        const vote = this.votes?.get(metadataCid)[0];
        return vote;
    }

    async getVoteByChoice(choice: string) {
        return this.votes?.query((vote) => vote.choice === choice);
    }

    async updateProposal(proposal: Proposal): Promise<string | null> {
        const prev = await this.getProposal(proposal.metadataCid);
        if (prev === null) {
            // create new if does not exist
            return await this.addProposal(proposal);
        }

        const cid = await this.proposals?.put({ ...prev, ...proposal });
        return cid ?? null;
    }

    async updateVote(vote: Vote): Promise<string | null> {
        const prev = await this.getVote(vote.metadataCid);
        if (prev === null) {
            // create new if does not exist
            return await this.addVote(vote);
        }

        const cid = await this.votes?.put({ ...prev, ...vote })
        return cid ?? null;
    }

    async deleteVote(metadataCid: string): Promise<string | null> {
        const cid = await this.votes?.del(metadataCid);
        return cid ?? null;
    }

    async getIpfsPeers() {
        const peerIds = (await this.node?.swarm.peers())?.map(peer => peer.peer);
        return peerIds;
    }

}
