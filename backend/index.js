const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: [
    "https://bfhl-frontend-two-zeta.vercel.app",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

//user details
const USER_ID = "mddanishalam_11082005"; 
const EMAIL_ID = "danish1326.be23@chitkarauniversity.edu.in";
const COLLEGE_ROLL_NUMBER = "2311981326";

//validation check for each entry

function validateEntry(entry) {
  if (typeof entry !== "string") return false;
  const trimmed = entry.trim();
  const regex = /^([A-Z])->([A-Z])$/;
  const match = trimmed.match(regex);
  if (!match) return false;
  if (match[1] === match[2]) return false; 
  return trimmed;
}

 
function hasCycle(nodes, childrenMap) {
  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    for (const child of (childrenMap.get(node) || [])) {
      if (dfs(child)) return true;
    }
    stack.delete(node);
    return false;
  }

  for (const node of nodes) {
    if (dfs(node)) return true;
  }
  return false;
}


function buildTree(node, childrenMap, visited = new Set()) {
  if (visited.has(node)) return { treeObj: {}, depth: 1 };
  visited.add(node);
  const children = childrenMap.get(node) || [];
  const treeObj = {};
  let maxChildDepth = 0;

  for (const child of children) {
    const { treeObj: childTree, depth: childDepth } = buildTree(child, childrenMap, new Set(visited));
    treeObj[child] = childTree;
    if (childDepth > maxChildDepth) maxChildDepth = childDepth;
  }

  return { treeObj, depth: 1 + maxChildDepth };
}

// Core processing function.

function processBFHL(data) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const validEdges = [];
  const seenEdges = new Set();

  // Step1: Validate and deduplicate
  for (const entry of data) {
    const trimmed = typeof entry === "string" ? entry.trim() : entry;
    const validated = validateEntry(entry);

    if (!validated) {
      invalidEntries.push(typeof entry === "string" ? entry : String(entry));
      continue;
    }

    if (seenEdges.has(validated)) {
      
      if (!duplicateEdges.includes(validated)) {
        duplicateEdges.push(validated);
      }
    } else {
      seenEdges.add(validated);
      validEdges.push(validated);
    }
  }

  const childrenMap = new Map();
  const parentMap = new Map();
  const allNodes = new Set();

  for (const edge of validEdges) {
    const [parent, child] = edge.split("->"); 
    allNodes.add(parent);
    allNodes.add(child);

    if (parentMap.has(child)) {
     
      continue;
    }
    parentMap.set(child, parent);
    if (!childrenMap.has(parent)) childrenMap.set(parent, []);
    childrenMap.get(parent).push(child);
  }

  // Step 3: Find roots
  const childNodes = new Set(parentMap.keys());
  const roots = [...allNodes].filter((n) => !childNodes.has(n)).sort();

  // Step 4: Group nodes into connected components
  const adjUndirected = new Map();
  for (const node of allNodes) {
    adjUndirected.set(node, new Set());
  }
  for (const [child, parent] of parentMap.entries()) {
    adjUndirected.get(parent).add(child);
    adjUndirected.get(child).add(parent);
  }

  const visitedNodes = new Set();
  const groups = [];

  function bfsGroup(start) {
    const queue = [start];
    const group = new Set();
    while (queue.length) {
      const node = queue.shift();
      if (group.has(node)) continue;
      group.add(node);
      for (const neighbor of adjUndirected.get(node) || []) {
        if (!group.has(neighbor)) queue.push(neighbor);
      }
    }
    return group;
  }

  for (const node of [...allNodes].sort()) {
    if (!visitedNodes.has(node)) {
      const group = bfsGroup(node);
      group.forEach((n) => visitedNodes.add(n));
      groups.push(group);
    }
  }

  // Step 5: Build hierarchies
  const hierarchies = [];

  for (const group of groups) {
    const groupNodes = [...group];

    // Detect cycle within this group
    const groupChildrenMap = new Map();
    for (const node of groupNodes) {
      groupChildrenMap.set(node, childrenMap.get(node) ? [...childrenMap.get(node)].filter((c) => group.has(c)) : []);
    }

    const cycleDetected = hasCycle(groupNodes, groupChildrenMap);

    if (cycleDetected) {
      const cycleRoot = [...groupNodes].sort()[0];
      hierarchies.push({
        root: cycleRoot,
        tree: {},
        has_cycle: true,
      });
    } else {
     
      const groupRoots = groupNodes.filter((n) => !childNodes.has(n)).sort();

      const treeRoot = groupRoots.length > 0 ? groupRoots[0] : [...groupNodes].sort()[0];

      const { treeObj, depth } = buildTree(treeRoot, childrenMap);

      hierarchies.push({
        root: treeRoot,
        tree: { [treeRoot]: treeObj },
        depth,
      });
    }
  }

  // step 6: Summary
  const nonCyclicTrees = hierarchies.filter((h) => !h.has_cycle);
  const cyclicGroups = hierarchies.filter((h) => h.has_cycle);

  let largestTreeRoot = "";
  let maxDepth = -1;
  for (const h of nonCyclicTrees) {
    if (h.depth > maxDepth || (h.depth === maxDepth && h.root < largestTreeRoot)) {
      maxDepth = h.depth;
      largestTreeRoot = h.root;
    }
  }

  const summary = {
    total_trees: nonCyclicTrees.length,
    total_cycles: cyclicGroups.length,
    largest_tree_root: largestTreeRoot,
  };

  return {
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL_NUMBER,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary,
  };
}

// Routes

app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "Request body must have a 'data' array." });
    }
    const result = processBFHL(data);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "BFHL API is running." });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BFHL backend running on https://bfhl-backend-55u6.onrender.com`);
});
