// import IPFS from "ipfs-core";
// multiformats is v9.9 -- in order to not break orbit-db (which is using transitive deps for some reason !!!)
// multiformats-latest is v10 -- which is compatible with ipfs
//
import { CID } from "multiformats-latest";
// import type { CID as CIDType } from 'multiformats/cid'
import { Ballot } from "./ballot";
// import type { DAO, Proposal, Vote } from "./ballot/ballot";


export async function main() {

    const ballot = new Ballot();

    await ballot.create();

    console.log(ballot.orbitdb?.id);
    console.log(ballot.votes?.id);

    console.log("----- Adding -----")
    const choices = ["Yes", "No"];
    const hashes = ["QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ", "QmdzDacgJ9EQF9Z8G3L1fzFwiEu255Nm5WiCey9ntrDPSL "];
    for (const hash of hashes) {
        const cidString = await ballot.addVote({ metadataCid: hash, choice: choices[Math.floor(choices.length * Math.random())] });
        const voteCid = CID.parse(cidString ?? "");
        const content = await ballot.node?.dag.get(voteCid);
        console.log(content?.value);
    }

    console.log("----- getAll -----")
    const votes = await ballot.getAllVotes()
    for (const vote of votes) {
        console.log(vote);
    }

    console.log("----- get -----")
    const v = ballot.getVote(hashes[0]);
    console.log(v);

    console.log("----- Swarm -----");
    await ballot.node?.config.set("Addresses.Swarm", ['/ip4/0.0.0.0/tcp/4002', '/ip4/127.0.0.1/tcp/4003/ws']);

    const id = await ballot.node?.id()
    console.log("id addres:")
    console.log(id?.addresses);

    console.log("---- IPFS peers ---- ");
    const peers = await ballot.getIpfsPeers();
    console.log(peers?.length);
    console.log(peers);

    console.log("---- libp2p? ----");
    console.log(ballot.node);

    return ballot;
}


main();