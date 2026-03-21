#!/usr/bin/env bash
# mex scaffold visualizer — launches a local server with interactive graph visualization
set -euo pipefail

# Find scaffold directory (where ROUTER.md lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/ROUTER.md" ]]; then
    SCAFFOLD_DIR="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/../ROUTER.md" ]]; then
    SCAFFOLD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
    echo "Error: Cannot find ROUTER.md. Run this script from the scaffold directory."
    exit 1
fi

PORT=4444

# Check if port is already in use
if lsof -i :$PORT >/dev/null 2>&1; then
    echo "Port $PORT is already in use. Kill the existing process or choose another port."
    exit 1
fi

echo ""
echo "  mex scaffold visualizer"
echo "  ─────────────────────────"
echo "  Serving at http://localhost:$PORT"
echo "  Press Ctrl+C to stop"
echo ""

# Auto-open browser after a short delay
(sleep 1 && {
    if command -v open >/dev/null 2>&1; then
        open "http://localhost:$PORT"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:$PORT"
    fi
}) &

# Run the embedded Python server
python3 - "$SCAFFOLD_DIR" "$PORT" << 'PYTHON_SERVER'
import sys
import os
import re
import json
import glob
import signal
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

SCAFFOLD_DIR = sys.argv[1]
PORT = int(sys.argv[2])

def signal_handler(sig, frame):
    print("\n  Shutting down...")
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def parse_frontmatter(filepath):
    """Parse YAML frontmatter from a markdown file without PyYAML."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return None

    # Extract frontmatter between --- delimiters
    match = re.match(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return None

    fm_text = match.group(1)
    result = {
        'name': '',
        'description': '',
        'triggers': [],
        'edges': [],
        'last_updated': ''
    }

    # Parse the frontmatter line by line
    lines = fm_text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]

        # Simple key: value
        kv = re.match(r'^(\w[\w_]*):\s*(.+)$', line)
        if kv:
            key, val = kv.group(1), kv.group(2).strip()
            if key in ('name', 'description', 'last_updated'):
                result[key] = val.strip('"').strip("'")
            i += 1
            continue

        # triggers array
        if re.match(r'^triggers:\s*$', line):
            i += 1
            while i < len(lines) and re.match(r'^\s+-\s+', lines[i]):
                val = re.sub(r'^\s+-\s+', '', lines[i]).strip().strip('"').strip("'")
                result['triggers'].append(val)
                i += 1
            continue

        # edges array
        if re.match(r'^edges:\s*$', line):
            i += 1
            while i < len(lines):
                target_match = re.match(r'^\s+-\s+target:\s*(.+)$', lines[i])
                if target_match:
                    edge = {'target': target_match.group(1).strip(), 'condition': ''}
                    i += 1
                    # Look for condition on next line
                    if i < len(lines):
                        cond_match = re.match(r'^\s+condition:\s*(.+)$', lines[i])
                        if cond_match:
                            edge['condition'] = cond_match.group(1).strip()
                            i += 1
                    result['edges'].append(edge)
                else:
                    # Not an edge entry — done with edges block
                    break
            continue

        i += 1

    return result


def scan_scaffold():
    """Scan all .md files in the scaffold and return graph data."""
    nodes = []
    edges = []
    node_ids = set()

    # Collect all relevant .md files
    md_files = []

    # Root level scaffold files
    for name in ['ROUTER.md', 'AGENTS.md', 'SETUP.md', 'SYNC.md']:
        path = os.path.join(SCAFFOLD_DIR, name)
        if os.path.isfile(path):
            md_files.append((name, path))

    # Context files
    ctx_dir = os.path.join(SCAFFOLD_DIR, 'context')
    if os.path.isdir(ctx_dir):
        for f in sorted(os.listdir(ctx_dir)):
            if f.endswith('.md'):
                md_files.append((f'context/{f}', os.path.join(ctx_dir, f)))

    # Pattern files
    pat_dir = os.path.join(SCAFFOLD_DIR, 'patterns')
    if os.path.isdir(pat_dir):
        for f in sorted(os.listdir(pat_dir)):
            if f.endswith('.md'):
                md_files.append((f'patterns/{f}', os.path.join(pat_dir, f)))

    # Parse all files
    file_data = {}
    for rel_path, abs_path in md_files:
        fm = parse_frontmatter(abs_path)
        if fm is None:
            fm = {'name': rel_path, 'description': '', 'triggers': [], 'edges': [], 'last_updated': ''}

        # Determine type
        if '/' not in rel_path:
            ftype = 'root'
        elif rel_path.startswith('context/'):
            ftype = 'context'
        elif rel_path.startswith('patterns/'):
            ftype = 'pattern'
        else:
            ftype = 'other'

        file_data[rel_path] = {
            'id': rel_path,
            'name': fm.get('name', '') or rel_path,
            'filename': rel_path,
            'description': fm.get('description', ''),
            'type': ftype,
            'triggers': fm.get('triggers', []),
            'edges_raw': fm.get('edges', []),
            'last_updated': fm.get('last_updated', '')
        }
        node_ids.add(rel_path)

    # Build nodes and edges
    for rel_path, data in file_data.items():
        nodes.append({
            'id': data['id'],
            'name': data['name'],
            'filename': data['filename'],
            'description': data['description'],
            'type': data['type'],
            'triggers': data['triggers'],
            'last_updated': data['last_updated'],
            'edge_count': len(data['edges_raw'])
        })

        for edge in data['edges_raw']:
            target = edge.get('target', '')
            if target in node_ids:
                edges.append({
                    'source': rel_path,
                    'target': target,
                    'condition': edge.get('condition', '')
                })

    return {'nodes': nodes, 'edges': edges}


HTML_PAGE = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mex scaffold visualizer</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0d1117;
    color: #e6edf3;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    overflow: hidden;
    height: 100vh;
    width: 100vw;
  }

  #header {
    position: fixed;
    top: 0; left: 0;
    z-index: 100;
    padding: 20px 28px;
    pointer-events: none;
  }
  #header h1 {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: #ffffff;
  }
  #header h1 span {
    color: #1944F1;
  }
  #header p {
    font-size: 12px;
    color: #8b949e;
    margin-top: 2px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    font-weight: 500;
  }

  #legend {
    position: fixed;
    bottom: 24px; left: 28px;
    z-index: 100;
    display: flex;
    gap: 20px;
    font-size: 12px;
    color: #8b949e;
    pointer-events: none;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  #side-panel {
    position: fixed;
    top: 0; right: 0;
    width: 360px;
    height: 100vh;
    background: #161b22;
    border-left: 1px solid #30363d;
    z-index: 200;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow-y: auto;
    padding: 0;
  }
  #side-panel.open { transform: translateX(0); }

  .panel-header {
    padding: 24px 24px 16px;
    border-bottom: 1px solid #30363d;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .panel-close {
    background: none;
    border: none;
    color: #8b949e;
    font-size: 20px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    transition: all 0.15s;
  }
  .panel-close:hover { background: #30363d; color: #e6edf3; }

  .panel-title {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    word-break: break-word;
  }
  .panel-filename {
    font-size: 12px;
    color: #8b949e;
    margin-top: 4px;
    font-family: "SF Mono", "Fira Code", monospace;
  }
  .panel-type-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 3px 8px;
    border-radius: 12px;
    margin-top: 8px;
  }

  .panel-section {
    padding: 16px 24px;
    border-bottom: 1px solid #21262d;
  }
  .panel-section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #8b949e;
    margin-bottom: 8px;
  }
  .panel-description {
    font-size: 13px;
    line-height: 1.6;
    color: #c9d1d9;
  }

  .panel-edge {
    padding: 8px 12px;
    background: #0d1117;
    border-radius: 8px;
    margin-bottom: 6px;
    border: 1px solid #21262d;
  }
  .panel-edge-target {
    font-size: 13px;
    font-weight: 500;
    color: #58a6ff;
    font-family: "SF Mono", "Fira Code", monospace;
  }
  .panel-edge-condition {
    font-size: 11px;
    color: #8b949e;
    margin-top: 3px;
    line-height: 1.4;
  }

  .panel-trigger {
    display: inline-block;
    font-size: 11px;
    padding: 3px 10px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 12px;
    margin: 2px 3px 2px 0;
    color: #c9d1d9;
  }

  #empty-state {
    display: none;
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 50;
  }
  #empty-state h2 {
    font-size: 20px;
    color: #8b949e;
    font-weight: 500;
    margin-bottom: 8px;
  }
  #empty-state p {
    font-size: 14px;
    color: #484f58;
  }

  #tooltip {
    position: fixed;
    pointer-events: none;
    z-index: 300;
    background: #1c2128;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    color: #c9d1d9;
    opacity: 0;
    transition: opacity 0.15s;
    max-width: 280px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  #tooltip.visible { opacity: 1; }
  .tooltip-label {
    font-size: 10px;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>

<div id="header">
  <h1><span>mex</span></h1>
  <p>scaffold visualizer</p>
</div>

<div id="legend">
  <div class="legend-item"><div class="legend-dot" style="background:#f0a500"></div> Root files</div>
  <div class="legend-item"><div class="legend-dot" style="background:#1944F1"></div> Context</div>
  <div class="legend-item"><div class="legend-dot" style="background:#2ea043"></div> Patterns</div>
</div>

<div id="empty-state">
  <h2>No edges found</h2>
  <p>Run setup first to populate the scaffold</p>
</div>

<div id="tooltip"></div>

<div id="side-panel">
  <div class="panel-header">
    <div>
      <div class="panel-title" id="panel-title"></div>
      <div class="panel-filename" id="panel-filename"></div>
      <div class="panel-type-badge" id="panel-badge"></div>
    </div>
    <button class="panel-close" id="panel-close">&times;</button>
  </div>
  <div id="panel-body"></div>
</div>

<svg id="graph"></svg>

<script>
const COLORS = {
  root: '#f0a500',
  context: '#1944F1',
  pattern: '#2ea043',
  other: '#8b949e'
};

const GLOW_COLORS = {
  root: 'rgba(240, 165, 0, 0.6)',
  context: 'rgba(25, 68, 241, 0.5)',
  pattern: 'rgba(46, 160, 67, 0.5)',
  other: 'rgba(139, 148, 158, 0.3)'
};

const SIZE = {
  'ROUTER.md': 28,
  'AGENTS.md': 20,
  'SETUP.md': 18,
  'SYNC.md': 18,
  context: 16,
  pattern: 12,
  other: 10
};

function nodeSize(d) {
  if (SIZE[d.filename]) return SIZE[d.filename];
  return SIZE[d.type] || SIZE.other;
}

function nodeColor(d) { return COLORS[d.type] || COLORS.other; }
function glowColor(d) { return GLOW_COLORS[d.type] || GLOW_COLORS.other; }

fetch('/api/graph')
  .then(r => r.json())
  .then(data => render(data));

function render(data) {
  const { nodes, edges } = data;

  if (edges.length === 0) {
    document.getElementById('empty-state').style.display = 'block';
    if (nodes.length === 0) return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  const svg = d3.select('#graph')
    .attr('width', width)
    .attr('height', height);

  // Defs for glow filter and gradients
  const defs = svg.append('defs');

  // Glow filter for edges
  const glowFilter = defs.append('filter')
    .attr('id', 'glow')
    .attr('x', '-50%').attr('y', '-50%')
    .attr('width', '200%').attr('height', '200%');
  glowFilter.append('feGaussianBlur')
    .attr('stdDeviation', '3')
    .attr('result', 'blur');
  glowFilter.append('feMerge')
    .selectAll('feMergeNode')
    .data(['blur', 'SourceGraphic'])
    .enter().append('feMergeNode')
    .attr('in', d => d);

  // Node glow filter
  const nodeGlow = defs.append('filter')
    .attr('id', 'node-glow')
    .attr('x', '-100%').attr('y', '-100%')
    .attr('width', '300%').attr('height', '300%');
  nodeGlow.append('feGaussianBlur')
    .attr('stdDeviation', '6')
    .attr('result', 'blur');
  nodeGlow.append('feMerge')
    .selectAll('feMergeNode')
    .data(['blur', 'SourceGraphic'])
    .enter().append('feMergeNode')
    .attr('in', d => d);

  // Highlight glow
  const hlGlow = defs.append('filter')
    .attr('id', 'highlight-glow')
    .attr('x', '-150%').attr('y', '-150%')
    .attr('width', '400%').attr('height', '400%');
  hlGlow.append('feGaussianBlur')
    .attr('stdDeviation', '10')
    .attr('result', 'blur');
  hlGlow.append('feMerge')
    .selectAll('feMergeNode')
    .data(['blur', 'SourceGraphic'])
    .enter().append('feMergeNode')
    .attr('in', d => d);

  // Arrow marker
  defs.append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', '#30363d');

  defs.append('marker')
    .attr('id', 'arrow-highlight')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', '#58a6ff');

  const g = svg.append('g');

  // Zoom
  const zoom = d3.zoom()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  svg.call(zoom);

  // Center initial view
  svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.9));

  // Build adjacency for hover highlighting
  const adjacency = new Map();
  nodes.forEach(n => adjacency.set(n.id, new Set()));
  edges.forEach(e => {
    const sid = typeof e.source === 'object' ? e.source.id : e.source;
    const tid = typeof e.target === 'object' ? e.target.id : e.target;
    adjacency.get(sid)?.add(tid);
    adjacency.get(tid)?.add(sid);
  });

  // Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id(d => d.id).distance(140).strength(0.4))
    .force('charge', d3.forceManyBody().strength(-600).distanceMax(500))
    .force('center', d3.forceCenter(0, 0))
    .force('collision', d3.forceCollide().radius(d => nodeSize(d) + 20))
    .force('x', d3.forceX(0).strength(0.03))
    .force('y', d3.forceY(0).strength(0.03))
    .alphaDecay(0.015)
    .velocityDecay(0.4);

  // Draw edges
  const linkGroup = g.append('g').attr('class', 'links');
  const link = linkGroup.selectAll('line')
    .data(edges)
    .enter().append('line')
    .attr('stroke', '#30363d')
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.6)
    .attr('filter', 'url(#glow)')
    .attr('marker-end', 'url(#arrow)');

  // Edge hover zones (invisible wider lines for better hover targeting)
  const linkHover = linkGroup.selectAll('.link-hover')
    .data(edges)
    .enter().append('line')
    .attr('class', 'link-hover')
    .attr('stroke', 'transparent')
    .attr('stroke-width', 12)
    .on('mouseenter', (event, d) => {
      if (d.condition) {
        const tooltip = document.getElementById('tooltip');
        tooltip.innerHTML = '<div class="tooltip-label">Edge condition</div>' + d.condition;
        tooltip.classList.add('visible');
        tooltip.style.left = event.clientX + 12 + 'px';
        tooltip.style.top = event.clientY - 10 + 'px';
      }
    })
    .on('mousemove', (event) => {
      const tooltip = document.getElementById('tooltip');
      tooltip.style.left = event.clientX + 12 + 'px';
      tooltip.style.top = event.clientY - 10 + 'px';
    })
    .on('mouseleave', () => {
      document.getElementById('tooltip').classList.remove('visible');
    });

  // Draw nodes
  const nodeGroup = g.append('g').attr('class', 'nodes');

  const nodeG = nodeGroup.selectAll('g')
    .data(nodes)
    .enter().append('g')
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.1).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x; d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      })
    );

  // Node outer glow circle
  nodeG.append('circle')
    .attr('class', 'node-glow')
    .attr('r', d => nodeSize(d) + 4)
    .attr('fill', d => glowColor(d))
    .attr('filter', 'url(#node-glow)')
    .attr('opacity', 0.4);

  // Node main circle
  nodeG.append('circle')
    .attr('class', 'node-circle')
    .attr('r', d => nodeSize(d))
    .attr('fill', d => {
      // Subtle radial gradient effect via lighter center
      return nodeColor(d);
    })
    .attr('stroke', d => nodeColor(d))
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 0.8)
    .attr('fill-opacity', 0.85);

  // Node inner highlight
  nodeG.append('circle')
    .attr('class', 'node-inner')
    .attr('r', d => nodeSize(d) * 0.4)
    .attr('fill', 'rgba(255,255,255,0.15)');

  // Node labels
  nodeG.append('text')
    .attr('class', 'node-label')
    .attr('dy', d => nodeSize(d) + 16)
    .attr('text-anchor', 'middle')
    .attr('fill', '#c9d1d9')
    .attr('font-size', d => d.type === 'root' ? '12px' : '11px')
    .attr('font-weight', d => d.type === 'root' ? '600' : '400')
    .text(d => {
      const parts = d.filename.split('/');
      return parts[parts.length - 1].replace('.md', '');
    });

  // Folder prefix for non-root
  nodeG.filter(d => d.type !== 'root')
    .append('text')
    .attr('class', 'node-folder')
    .attr('dy', d => nodeSize(d) + 28)
    .attr('text-anchor', 'middle')
    .attr('fill', '#484f58')
    .attr('font-size', '9px')
    .text(d => {
      const parts = d.filename.split('/');
      return parts.length > 1 ? parts[0] + '/' : '';
    });

  // Hover interactions
  nodeG.on('mouseenter', (event, d) => {
    const connected = adjacency.get(d.id) || new Set();

    // Dim non-connected
    nodeG.transition().duration(200)
      .attr('opacity', n => (n.id === d.id || connected.has(n.id)) ? 1 : 0.15);

    link.transition().duration(200)
      .attr('stroke', e => {
        const sid = typeof e.source === 'object' ? e.source.id : e.source;
        const tid = typeof e.target === 'object' ? e.target.id : e.target;
        return (sid === d.id || tid === d.id) ? '#58a6ff' : '#30363d';
      })
      .attr('stroke-opacity', e => {
        const sid = typeof e.source === 'object' ? e.source.id : e.source;
        const tid = typeof e.target === 'object' ? e.target.id : e.target;
        return (sid === d.id || tid === d.id) ? 1 : 0.1;
      })
      .attr('stroke-width', e => {
        const sid = typeof e.source === 'object' ? e.source.id : e.source;
        const tid = typeof e.target === 'object' ? e.target.id : e.target;
        return (sid === d.id || tid === d.id) ? 2.5 : 1.5;
      })
      .attr('marker-end', e => {
        const sid = typeof e.source === 'object' ? e.source.id : e.source;
        const tid = typeof e.target === 'object' ? e.target.id : e.target;
        return (sid === d.id || tid === d.id) ? 'url(#arrow-highlight)' : 'url(#arrow)';
      });

    // Enlarge hovered node
    d3.select(event.currentTarget).select('.node-circle')
      .transition().duration(200).attr('r', nodeSize(d) * 1.2);
    d3.select(event.currentTarget).select('.node-glow')
      .transition().duration(200).attr('r', nodeSize(d) * 1.2 + 6).attr('opacity', 0.7);
    d3.select(event.currentTarget).select('.node-inner')
      .transition().duration(200).attr('r', nodeSize(d) * 0.5);
  });

  nodeG.on('mouseleave', (event, d) => {
    nodeG.transition().duration(300).attr('opacity', 1);
    link.transition().duration(300)
      .attr('stroke', '#30363d')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)');

    d3.select(event.currentTarget).select('.node-circle')
      .transition().duration(300).attr('r', nodeSize(d));
    d3.select(event.currentTarget).select('.node-glow')
      .transition().duration(300).attr('r', nodeSize(d) + 4).attr('opacity', 0.4);
    d3.select(event.currentTarget).select('.node-inner')
      .transition().duration(300).attr('r', nodeSize(d) * 0.4);
  });

  // Click to show side panel
  nodeG.on('click', (event, d) => {
    event.stopPropagation();
    showPanel(d, edges);
  });

  svg.on('click', () => {
    document.getElementById('side-panel').classList.remove('open');
  });

  document.getElementById('panel-close').addEventListener('click', () => {
    document.getElementById('side-panel').classList.remove('open');
  });

  // Simulation tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    linkHover
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    nodeG.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

function showPanel(d, allEdges) {
  const panel = document.getElementById('side-panel');
  const titleEl = document.getElementById('panel-title');
  const filenameEl = document.getElementById('panel-filename');
  const badgeEl = document.getElementById('panel-badge');
  const bodyEl = document.getElementById('panel-body');

  titleEl.textContent = d.name || d.filename;
  filenameEl.textContent = d.filename;

  const badgeColors = {
    root: { bg: 'rgba(240,165,0,0.15)', color: '#f0a500' },
    context: { bg: 'rgba(25,68,241,0.15)', color: '#4d7aff' },
    pattern: { bg: 'rgba(46,160,67,0.15)', color: '#2ea043' }
  };
  const bc = badgeColors[d.type] || { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' };
  badgeEl.textContent = d.type;
  badgeEl.style.background = bc.bg;
  badgeEl.style.color = bc.color;

  let html = '';

  if (d.description) {
    html += '<div class="panel-section">';
    html += '<div class="panel-section-title">Description</div>';
    html += '<div class="panel-description">' + escapeHtml(d.description) + '</div>';
    html += '</div>';
  }

  // Find edges from this node
  const outEdges = allEdges.filter(e => {
    const sid = typeof e.source === 'object' ? e.source.id : e.source;
    return sid === d.id;
  });
  const inEdges = allEdges.filter(e => {
    const tid = typeof e.target === 'object' ? e.target.id : e.target;
    return tid === d.id;
  });

  if (outEdges.length > 0) {
    html += '<div class="panel-section">';
    html += '<div class="panel-section-title">Outgoing edges (' + outEdges.length + ')</div>';
    outEdges.forEach(e => {
      const tid = typeof e.target === 'object' ? e.target.id : e.target;
      html += '<div class="panel-edge">';
      html += '<div class="panel-edge-target">' + escapeHtml(tid) + '</div>';
      if (e.condition) html += '<div class="panel-edge-condition">' + escapeHtml(e.condition) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  if (inEdges.length > 0) {
    html += '<div class="panel-section">';
    html += '<div class="panel-section-title">Incoming edges (' + inEdges.length + ')</div>';
    inEdges.forEach(e => {
      const sid = typeof e.source === 'object' ? e.source.id : e.source;
      html += '<div class="panel-edge">';
      html += '<div class="panel-edge-target">' + escapeHtml(sid) + '</div>';
      if (e.condition) html += '<div class="panel-edge-condition">' + escapeHtml(e.condition) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  if (d.triggers && d.triggers.length > 0) {
    html += '<div class="panel-section">';
    html += '<div class="panel-section-title">Triggers</div>';
    html += '<div>';
    d.triggers.forEach(t => {
      html += '<span class="panel-trigger">' + escapeHtml(t) + '</span>';
    });
    html += '</div></div>';
  }

  if (d.last_updated && d.last_updated !== '[YYYY-MM-DD]') {
    html += '<div class="panel-section">';
    html += '<div class="panel-section-title">Last updated</div>';
    html += '<div class="panel-description">' + escapeHtml(d.last_updated) + '</div>';
    html += '</div>';
  }

  bodyEl.innerHTML = html;
  panel.classList.add('open');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Handle window resize
window.addEventListener('resize', () => {
  d3.select('#graph')
    .attr('width', window.innerWidth)
    .attr('height', window.innerHeight);
});
</script>
</body>
</html>'''


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path

        if path == '/api/graph':
            data = scan_scaffold()
            payload = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        elif path == '/' or path == '/index.html':
            payload = HTML_PAGE.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        else:
            self.send_error(404)

    def log_message(self, format, *args):
        # Suppress request logs for clean output
        pass


server = HTTPServer(('localhost', PORT), Handler)
server.serve_forever()
PYTHON_SERVER
