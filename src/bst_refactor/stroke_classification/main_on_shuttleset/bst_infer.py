# BST inference script for ShuttleSet
# Loads a trained checkpoint and predicts stroke types.
# Suitable as a backend for Gradio GUI — call task.infer() to get predictions.
#
# Run from the repo root with both package roots on PYTHONPATH:
#   PYTHONPATH=src/bst_refactor:src/bst_refactor/stroke_classification \
#       python -m main_on_shuttleset.bst_infer
#
# See bst_train.py for detailed PyTorch/TF comparison comments.

import torch
from torch import Tensor, nn
from torch.utils.data import DataLoader

from pathlib import Path

from preparing_data.shuttleset_dataset import Dataset_npy_collated
from pipeline.config import TAXONOMIES, DEFAULT_TAXONOMY, Taxonomy
from main_on_shuttleset.bst_common import build_bst_network


@torch.no_grad()  # no gradient tracking needed for inference — saves memory
def infer(
    model: nn.Module,
    loader,
    device
):
    model.eval()  # disable dropout, set batchnorm to eval mode
    pred_ls = []

    for (human_pose, pos, shuttle, shuttle_missing), video_len, labels in loader:
        human_pose: Tensor = human_pose.to(device)
        shuttle: Tensor = shuttle.to(device)
        shuttle_missing: Tensor = shuttle_missing.to(device)
        pos: Tensor = pos.to(device)
        video_len: Tensor = video_len.to(device)

        human_pose = human_pose.view(*human_pose.shape[:-2], -1)
        logits = model(human_pose, shuttle, shuttle_missing, pos, video_len)

        # argmax gives predicted class index; .cpu() moves result back from GPU
        pred = torch.argmax(logits, dim=1).cpu()

        pred_ls.append(pred)

    # torch.cat joins list of batch predictions into one tensor
    return torch.cat(pred_ls)


class Task:
    def __init__(self, n_joints=17) -> None:
        self.use_cuda = torch.cuda.is_available()
        self.device = 'cuda' if self.use_cuda else 'cpu'
        self.n_joints = n_joints

    def prepare_loader(
        self,
        npy_collated_dir: Path,
        pose_style='Jn2B',
        batch_size=128,
    ):
        your_set = Dataset_npy_collated(npy_collated_dir, 'test', pose_style)

        self.infer_loader = DataLoader(
            dataset=your_set,
            batch_size=batch_size
        )
        self.pose_style = pose_style

    def get_network_architecture(
        self,
        *,
        model_name: str = 'BST_CG_AP',
        seq_len: int = 100,
        in_channels: int = 2,
        taxonomy: Taxonomy | None = None,
        n_active_classes: int,
        active_class_list: list[str],
    ):
        """Build the inference model at the supplied head dim.

        ``n_active_classes`` and ``active_class_list`` describe the
        architectural era of the weights being loaded; both must be
        supplied. For a post-fix run, read both from the run's
        ``manifest.yaml`` under ``extra.arch``. For pre-fix weights with
        no manifest arch block, pass
        ``n_active_classes=taxonomy.n_classes`` and
        ``active_class_list=taxonomy.class_list()`` explicitly to opt
        into the legacy full-taxonomy head.

        Mismatch between the weight file's head dim and
        ``n_active_classes`` raises a clear shape error inside
        ``load_state_dict``.
        """
        if taxonomy is None:
            taxonomy = TAXONOMIES[DEFAULT_TAXONOMY]
        self.taxonomy = taxonomy
        self.n_active_classes = n_active_classes
        self.active_class_list = active_class_list
        self.net, _n_bones = build_bst_network(
            model_name,
            n_joints=self.n_joints,
            pose_style=self.pose_style,
            in_channels=in_channels,
            n_class=self.n_active_classes,
            seq_len=seq_len,
            device=self.device,
        )

    def load_weight(self, weight_path: Path):
        self.net.load_state_dict(torch.load(str(weight_path), map_location=self.device, weights_only=True))

    def infer(self):
        return infer(self.net, self.infer_loader, self.device)


if __name__ == '__main__':
    # Inference example.
    #
    # Architecture is no longer a function of any flag; it has to come from
    # the run that produced the weights. Two paths:
    #   1. Post-fix weights: load ``extra.arch`` from the run's manifest.yaml
    #      and pass ``n_active_classes`` / ``active_class_list`` straight in.
    #   2. Pre-fix weights (no arch block in the manifest): fall back to the
    #      full taxonomy explicitly. The weight file shape is then
    #      ``taxonomy.n_classes`` and the decoder uses ``taxonomy.class_list()``.

    import yaml

    taxonomy = TAXONOMIES[DEFAULT_TAXONOMY]

    # Update to the run id you want to infer from.
    run_id = 'run_YYYYMMDD_HHMMSS'
    run_dir = Path('experiments') / run_id

    manifest_path = run_dir / 'manifest.yaml'
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = yaml.safe_load(f) or {}
        arch = manifest.get('extra', {}).get('arch')
    else:
        arch = None

    if arch is None:
        # Pre-fix run with no arch block; opt into legacy full-taxonomy head.
        n_active_classes = taxonomy.n_classes
        active_class_list = taxonomy.class_list()
    else:
        n_active_classes = arch['n_active_classes']
        active_class_list = arch['active_class_list']

    task = Task(n_joints=17)
    task.prepare_loader(
        # Example path; update the ablation_id suffix to whichever ablation
        # you're inferring on (e.g. une_merge_v1_split_v2_dropunk).
        # Format: npy_[3d_][seq{N}_]{ablation_id} (prefixes only when non-default).
        npy_collated_dir=Path(f'preparing_data/ShuttleSet_data_{taxonomy.name}')
                        / f"npy_{taxonomy.name}_split_v2_dropunk",
        pose_style="JnB_bone",
    )
    task.get_network_architecture(
        model_name='BST_CG_AP',
        seq_len=100,
        in_channels=2,
        taxonomy=taxonomy,
        n_active_classes=n_active_classes,
        active_class_list=active_class_list,
    )
    task.load_weight(Path('weight')
                     /"bst_CG_AP_JnB_bone_between_2_hits_with_max_limits_seq_100_une_merge_v1_2.pt")

    pred = task.infer()

    # Decode against the active class list so labels line up with the
    # head the model was built with.
    classes = task.active_class_list
    pred_cls = [classes[e] for e in pred]
    print(pred_cls)
