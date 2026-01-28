// ==================== CONSTANTS ====================
export const CARDS_PER_SESSION = 6;

export const RATING_MAP = {
  forgot: { label: '😫 Forgot', value: 0, color: 'bg-red-500' },
  struggled: { label: '🤔 Struggled', value: 2, color: 'bg-amber-500' },
  good: { label: '👍 Good', value: 4, color: 'bg-green-500' },
  perfect: { label: '🎯 Perfect', value: 5, color: 'bg-indigo-500' }
};

// ==================== PRE-LOADED PAPERS FROM NOTION ====================
// These serve as fallback data when Notion API is unavailable
export const INITIAL_PAPERS = [
  {
    id: "2efe9298-d1ff-80ed-aa32-f2ebaa4605ce",
    title: "MapAnything: Universal Feed-Forward Metric 3D Reconstruction",
    tags: ["Computer Vision", "3D Reconstruction"],
    authors: "Meta Reality Labs, Carnegie Mellon University",
    url: "https://arxiv.org/abs/2509.13414v1",
    notionUrl: "https://www.notion.so/2efe9298d1ff80edaa32f2ebaa4605ce",
    content: `MapAnything represents a unified approach to 3D reconstruction that consolidates over 12 different computer vision tasks into a single feed-forward neural network. 

Key Innovation: Factored scene representation that explicitly separates geometric components:
- Di: per-view depth maps
- Ri: local ray directions  
- Pi: camera poses
- m: global metric scale factor

Architecture: Multi-modal encoders process images through DINOv2 ViT-L features. A 24-layer alternating-attention transformer processes fused tokens. Factored output prediction uses DPT heads for dense outputs.

Training uses log-space losses for handling scale variations, adaptive robust loss functions, and probabilistic input augmentation.

Results: Matches or exceeds specialist methods like VGGT and Pow3R across 2-100 input views. State-of-the-art on two-view dense reconstruction, single-view camera calibration, monocular/multi-view metric depth estimation.`
  },
  {
    id: "2cde9298-d1ff-804d-a27c-d7a50bcf8fd7",
    title: "Depth Anything 3: Recovering the Visual Space from Any Views",
    tags: ["3D Reconstruction", "Computer Vision"],
    authors: "Haotong Lin, Sili Chen, Jun Hao Liew, Donny Y. Chen, Zhenyu Li, Guang Shi, Jiashi Feng, Bingyi Kang",
    url: "https://arxiv.org/abs/2511.10647",
    notionUrl: "https://www.notion.so/2cde9298d1ff804da27cd7a50bcf8fd7",
    content: `Depth Anything 3 (DA3) introduces a unified model for recovering 3D visual space from any number of views, with or without known camera poses.

Core Approach: Minimal modeling strategy using a single, unmodified Vision Transformer (DINOv2) with a carefully designed geometric representation.

Depth-Ray Representation:
- Depth map D(u,v): per-pixel depth values
- Ray map r = (t, d): 6D vector encoding ray origin (camera center) and direction

Architecture:
- Single Transformer Backbone (DINOv2-ViT-L)
- Input-Adaptive Cross-View Attention: initial layers apply self-attention within each image, subsequent layers alternate between cross-view and within-view attention
- Dual-DPT Head: shared reassembly modules split into distinct fusion layers for depth and ray prediction

Teacher-Student Training: DA3-Teacher trained on synthetic data generates pseudo-labels for real-world datasets.

Results: 35.7% average improvement in camera pose accuracy over VGGT. 23.6% improvement over VGGT in geometry reconstruction. DA3-Large (0.36B params) outperforms VGGT (1.19B params) despite being 3x smaller.`
  },
  {
    id: "2e6e9298-d1ff-8023-9405-d51d8b9bb62f",
    title: "VGGT: Visual Geometry Grounded Transformer",
    tags: ["Computer Vision", "3D Reconstruction", "Transformer", "Feed-Forward Network", "Camera Estimation"],
    authors: "Jianyuan Wang, Minghao Chen, Nikita Karaev, Andrea Vedaldi, Christian Rupprecht, David Novotny",
    url: "https://arxiv.org/abs/2503.11651",
    notionUrl: "https://www.notion.so/2e6e9298d1ff80239405d51d8b9bb62f",
    content: `VGGT (Visual Geometry Grounded Transformer) introduces a unified neural network approach to comprehensive scene reconstruction, replacing slow iterative optimization of SfM and MVS with a single feed-forward network.

Core Innovation: Simultaneously predicts camera poses, depth maps, 3D point clouds, and dense tracking features from 1 to hundreds of images in a single forward pass.

Architecture (1.2B parameters):
- Input: DINOv2 tokenization + camera tokens + register tokens
- Alternating-Attention (AA) mechanism: 24 layers each of frame-wise self-attention and global self-attention
- Multi-Task Prediction Heads: Camera head, Dense prediction heads (DPT), Tracking module (CoTracker2-based)

Training Loss: L_total = L_camera + L_depth + L_pmap + L_track

Results:
- Camera Pose: 85.3 AUC@30° vs VGGSfM's 78.9 in ~0.2 seconds
- DTU Depth: 0.382 vs DUSt3R's 1.741 Overall error
- ETH3D Point Cloud: 0.709 vs DUSt3R's 1.005

Significance: Paradigm shift toward efficient neural inference for 3D reconstruction, enabling real-time applications.`
  },
  {
    id: "2f0e9298-d1ff-8000-8188-f04241966a4e",
    title: "Image-Based Relocalization and Alignment for Long-Term Monitoring of Dynamic Underwater Environments",
    tags: ["Change Detection", "Computer Vision", "3D Reconstruction", "Underwater Monitoring"],
    authors: "",
    url: "https://arxiv.org/abs/2503.04096",
    notionUrl: "https://www.notion.so/2f0e9298d1ff80008188f04241966a4e",
    content: `Addresses long-term monitoring of underwater ecosystems using computer vision.

Hierarchical Pipeline:
1. Global Visual Place Recognition (VPR): MixVPR, CosPlace, NetVLAD, AnyLoc, MegaLoc, CricaVPR for global image descriptors
2. Local Feature Matching: SuperPoint + LightGlue for dense keypoint correspondences
3. Homography Estimation: 2D homography matrix H with bidirectional reprojection error filtering
4. Segmentation Warping: SAM2 for semantic segmentation, IoU metrics for change detection

SQUIDLE+ VPR Benchmark: First large-scale benchmark for underwater VPR
- Diverse platforms: AUVs, ROVs, towed cameras
- Multi-temporal: days to years separation
- Geographic diversity: Okinawa, Tasman Fracture, St Helens, Eiffel Tower dataset

Results:
- MegaLoc + SuperPoint-LightGlue achieves comparable performance to brute-force while being ~100x faster
- 99% precision on Okinawa, 72% on St Helens after filtering

Applications: Automated ecosystem monitoring, change detection for coral reefs and marine conservation.`
  }
];
