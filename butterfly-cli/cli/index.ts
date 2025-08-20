#!/usr/bin/env node

import { Args, Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { buildCommand } from "./commands/build";
import { validateCommand } from "./commands/validate";
import { serveCommand } from "./commands/serve";

// Common options
const sourceDir = Options.directory("source").pipe(
  Options.withAlias("s"),
  Options.withDefault(".")
);

const verbose = Options.boolean("verbose");

// Build command
const buildArgs = {
  source: sourceDir,
  output: Options.directory("output").pipe(Options.withAlias("o"), Options.withDefault("dist")),
  verbose,
};

const build = Command.make("build", buildArgs, buildCommand);

// Validate command  
const validateArgs = {
  source: sourceDir,
};

const validate = Command.make("validate", validateArgs, validateCommand);

// Serve command
const serveArgs = {
  source: sourceDir,
  port: Options.integer("port").pipe(Options.withAlias("p"), Options.withDefault(3000)),
};

const serve = Command.make("serve", serveArgs, serveCommand);

// Main butterfly command
const butterfly = Command.make("butterfly", {}, () => 
  Effect.succeed(console.log("🦋 Butterfly CLI - Static site generator for Moneta applications"))
).pipe(
  Command.withSubcommands([build, validate, serve])
);

// Run the CLI
const cli = Command.run(butterfly, {
  name: "Butterfly CLI",
  version: "v0.1.0",
});

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer), 
  Effect.catchAll((error) => {
    console.error(`❌ CLI Error: ${error}`);
    console.error(`Error type: ${typeof error}`);
    console.error(`Error message: ${error?.message || 'No message'}`);
    console.error(`Stack trace: ${error?.stack || 'No stack'}`);
    return Effect.sync(() => process.exit(1));
  }),
  NodeRuntime.runMain
);