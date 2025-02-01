{ pkgs, system }:

import (pkgs.fetchFromGitHub {
  owner = "spartan-holochain-counsel";
  repo = "nix-overlay";
  rev = "882b236626235f271465b726db161b644d35d84c";
  sha256 = "SX0dnvB50W4dt7aXtacgYVwJ5D0VoR8+FSWwx3/BUfo=";
}) {
  inherit pkgs;
  inherit system;
}
