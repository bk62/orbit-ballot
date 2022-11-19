// import IPFS from "ipfs-core";
// multiformats is v9.9 -- in order to not break orbit-db (which is using transitive deps for some reason !!!)
// multiformats-latest is v10 -- which is compatible with ipfs
//
import { CID } from "multiformats-latest";
// import type { CID as CIDType } from 'multiformats/cid'
import { Ballot } from "./ballot";
// import type { DAO, Proposal, Vote } from "./ballot/ballot";


export async function p2p_main() {
    const topic = "12D3KooWFzeNrvpubddzutrf4zDDNUx23PNwnfMmvVcHtyrqZtBA";

    // console.log("Ballot 1");

    // const ballot1 = new Ballot({
    //     repo: "./ipfs-ballot-1",
    //     config: {
    //         Addresses: {
    //             Swarm: ['/ip4/0.0.0.0/tcp/4004', '/ip4/127.0.0.1/tcp/4005/ws']
    //         }
    //     }
    // }, topic);
    // await ballot1.create();

    // console.log(ballot1.orbitdb?.id);
    // console.log(ballot1.votes?.id);

    console.log("Ballot 2");

    const ballot2 = new Ballot({
        repo: "./ipfs-ballot-2",
        config: {
            Addresses: {
                Swarm: ['/ip4/0.0.0.0/tcp/4006', '/ip4/127.0.0.1/tcp/4007/ws']
            }
        }
    }, topic);

    await ballot2.create();

    console.log(ballot2.orbitdb?.id);
    console.log(ballot2.votes?.id);

    console.log("Sending pubsub message from ballot 2");
    ballot2.sendMessage(topic, { msg: "Test message" });

    console.log("Getting a couple manifests");
    console.log("votes manifest");
    console.log(await ballot2.node?.dag.get(CID.parse("zdpuAsZFMkZy2sCHFvVcVdgoBFgNhyrXuKtDCsxb918Ybz226")));
    console.log("access conrtoller manifest");
    console.log(await ballot2.node?.dag.get(CID.parse("zdpuAuWr8UACgtyDwkfu9RVV7S7QknZh8ZW7Vn39NvyV1ZDPD")));


}
p2p_main();