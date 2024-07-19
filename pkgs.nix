{ pkgs, system }:

import (pkgs.fetchFromGitHub {
  owner = "spartan-holochain-counsel";
  repo = "nix-overlay";
  rev = "60304b93954c201cb4e1f75eb17295789e1bf967";
  sha256 = "qgewX2TbZdlPRkGPvyvUmo7gDj4122JGypi1uwdXcTg=";
}) {
  inherit pkgs;
  inherit system;
}
