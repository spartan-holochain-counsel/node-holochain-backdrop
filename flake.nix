{
  description = "Holochain Development Env";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import ./pkgs.nix {
        pkgs = nixpkgs.legacyPackages.${system};
        inherit system;
      };
    in
    {
      devShells.${system} = {
        default = pkgs.mkShell {
          buildInputs = with pkgs; [
            holochain_0-4
            lair-keystore_0-5

            nodejs_22
          ];

          shellHook = ''
            export PS1="\[\e[1;32m\](flake-env)\[\e[0m\] \[\e[1;34m\]\u@\h:\w\[\e[0m\]$ "
          '';
        };
      };
    };
}
