"use client";

import { callServerPromise } from "./callServerPromise";
import { LoadingIcon } from "@/components/LoadingIcon";
import AutoForm, { AutoFormSubmit } from "@/components/ui/auto-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { workflowAPINodeType } from "@/db/schema";
import { getInputsFromWorkflow } from "@/lib/getInputsFromWorkflow";
import { createRun } from "@/server/createRun";
import { createDeployments } from "@/server/curdDeploments";
import type { getMachines } from "@/server/curdMachine";
import type { findFirstTableWithVersion } from "@/server/findFirstTableWithVersion";
import { Copy, ExternalLink, Info, MoreVertical, Play } from "lucide-react";
import { parseAsInteger, useQueryState } from "next-usequerystate";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";

export function VersionSelect({
  workflow,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
}) {
  const [version, setVersion] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version?.toString() ?? "",
  });
  return (
    <Select
      value={version}
      onValueChange={(v) => {
        setVersion(v);
      }}
    >
      <SelectTrigger className="w-[100px]">
        <SelectValue placeholder="Select a version" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Versions</SelectLabel>
          {workflow?.versions.map((x) => (
            <SelectItem key={x.id} value={x.version?.toString() ?? ""}>
              {x.version}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function MachineSelect({
  machines,
}: {
  machines: Awaited<ReturnType<typeof getMachines>>;
}) {
  const [machine, setMachine] = useQueryState("machine", {
    defaultValue: machines?.[0].id ?? "",
  });
  return (
    <Select
      value={machine}
      onValueChange={(v) => {
        setMachine(v);
      }}
    >
      <SelectTrigger className="w-[180px] text-start">
        <SelectValue placeholder="Select a machine" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Machines</SelectLabel>
          {machines?.map((x) => (
            <SelectItem key={x.id} value={x.id ?? ""}>
              {x.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function RunWorkflowButton({
  workflow,
  machines,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
  machines: Awaited<ReturnType<typeof getMachines>>;
}) {
  const [version] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version ?? 1,
    ...parseAsInteger,
  });
  const [machine] = useQueryState("machine", {
    defaultValue: machines[0].id ?? "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const [values, setValues] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  const schema = useMemo(() => {
    const workflow_version = getWorkflowVersionFromVersionIndex(
      workflow,
      version
    );
    const inputs = getInputsFromWorkflow(workflow_version);

    if (!inputs) return null;

    return z.object({
      ...Object.fromEntries(
        inputs?.map((x) => {
          return [x?.input_id, z.string().optional()];
        })
      ),
    });
  }, [version]);

  const runWorkflow = async () => {
    console.log(values);

    const val = Object.keys(values).length > 0 ? values : undefined;

    const workflow_version_id = workflow?.versions.find(
      (x) => x.version === version
    )?.id;
    console.log(workflow_version_id);
    if (!workflow_version_id) return;

    setIsLoading(true);
    try {
      const origin = window.location.origin;
      await callServerPromise(
        createRun({
          origin,
          workflow_version_id,
          machine_id: machine,
          inputs: val,
          isManualRun: true,
        })
      );
      // console.log(res.json());
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
    }

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="appearance-none hover:cursor-pointer">
        <Button className="gap-2" disabled={isLoading}>
          Run {isLoading ? <LoadingIcon /> : <Play size={14} />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Run inputs</DialogTitle>
          <DialogDescription>
            Run your workflow with custom inputs
          </DialogDescription>
        </DialogHeader>
        {/* <div className="max-h-96 overflow-y-scroll"> */}
        {schema && (
          <AutoForm
            formSchema={schema}
            values={values}
            onValuesChange={setValues}
            onSubmit={runWorkflow}
          >
            <div className="flex justify-end">
              <AutoFormSubmit>
                Run
                <span className="ml-2">
                  {isLoading ? <LoadingIcon /> : <Play size={14} />}
                </span>
              </AutoFormSubmit>
            </div>
          </AutoForm>
        )}
        {!schema && (
          <Button className="gap-2" disabled={isLoading} onClick={runWorkflow}>
            Confirm {isLoading ? <LoadingIcon /> : <Play size={14} />}
          </Button>
        )}
        {/* </div> */}
        {/* <div className="max-h-96 overflow-y-scroll">{view}</div> */}
      </DialogContent>
    </Dialog>
  );
}

export function CreateDeploymentButton({
  workflow,
  machines,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
  machines: Awaited<ReturnType<typeof getMachines>>;
}) {
  const [version] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version ?? 1,
    ...parseAsInteger,
  });
  const [machine] = useQueryState("machine", {
    defaultValue: machines[0].id ?? "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const workflow_version_id = workflow?.versions.find(
    (x) => x.version === version
  )?.id;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" disabled={isLoading} variant="outline">
          Deploy {isLoading ? <LoadingIcon /> : <MoreVertical size={14} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem
          onClick={async () => {
            if (!workflow_version_id) return;

            setIsLoading(true);
            await callServerPromise(
              createDeployments(
                workflow.id,
                workflow_version_id,
                machine,
                "production"
              )
            );
            setIsLoading(false);
          }}
        >
          Production
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            if (!workflow_version_id) return;

            setIsLoading(true);
            await callServerPromise(
              createDeployments(
                workflow.id,
                workflow_version_id,
                machine,
                "staging"
              )
            );
            setIsLoading(false);
          }}
        >
          Staging
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CopyWorkflowVersion({
  workflow,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
}) {
  const [version] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version ?? 1,
    ...parseAsInteger,
  });
  const workflow_version = workflow?.versions.find(
    (x) => x.version === version
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" variant="outline">
          Copy Workflow <Copy size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem
          onClick={async () => {
            if (!workflow) return;

            // console.log(workflow_version?.workflow);

            workflow_version?.workflow?.nodes.forEach((x: any) => {
              if (x?.type === "ComfyDeploy") {
                x.widgets_values[1] = workflow.id;
                x.widgets_values[2] = workflow_version.version;
              }
            });

            navigator.clipboard.writeText(
              JSON.stringify(workflow_version?.workflow)
            );
            toast("Copied to clipboard");
          }}
        >
          Copy (JSON)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            navigator.clipboard.writeText(
              JSON.stringify(workflow_version?.workflow_api)
            );
            toast("Copied to clipboard");
          }}
        >
          Copy API (JSON)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getWorkflowVersionFromVersionIndex(
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>,
  version: number
) {
  const workflow_version = workflow?.versions.find((x) => x.version == version);

  return workflow_version;
}

export default async function fetcher<JSON = unknown>(
  input: RequestInfo,
  init?: RequestInit
): Promise<JSON> {
  const res = await fetch(input, init);
  return res.json();
}

export function ViewWorkflowDetailsButton({
  workflow,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
}) {
  const [version] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version ?? 1,
    ...parseAsInteger,
  });
  const [isLoading, setIsLoading] = useState(false);

  const [open, setOpen] = useState(false);

  const {
    data,
    error,
    isLoading: isNodesIndexLoading,
  } = useSWR(
    "https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/extension-node-map.json",
    fetcher
  );

  const groupedByAuxName = useMemo(() => {
    if (!data) return null;

    // console.log(data);

    const workflow_version = getWorkflowVersionFromVersionIndex(
      workflow,
      version
    );

    const api = workflow_version?.workflow_api;

    if (!api) return null;

    const crossCheckedApi = Object.entries(api)
      .map(([_, value]) => {
        const classType = value.class_type;
        const classTypeData = Object.entries(data).find(([_, nodeArray]) =>
          nodeArray[0].includes(classType)
        );
        return classTypeData ? { node: value, classTypeData } : null;
      })
      .filter((item) => item !== null);

    // console.log(crossCheckedApi);

    const groupedByAuxName = crossCheckedApi.reduce(
      (acc, data) => {
        if (!data) return acc;

        const { node, classTypeData } = data;
        const auxName = classTypeData[1][1].title_aux;
        // console.log(auxName);
        if (!acc[auxName]) {
          acc[auxName] = {
            url: classTypeData[0],
            node: [],
          };
        }
        acc[auxName].node.push(node);
        return acc;
      },
      {} as Record<
        string,
        {
          node: z.infer<typeof workflowAPINodeType>[];
          url: string;
        }
      >
    );

    // console.log(groupedByAuxName);

    return groupedByAuxName;
  }, [version, data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="appearance-none hover:cursor-pointer">
        <Button className="gap-2" variant="outline">
          Details <Info size={14} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Workflow Details</DialogTitle>
          <DialogDescription>
            View your custom nodes, models, external files used in this workflow
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto max-h-[400px] w-full">
          <Table>
            <TableHeader className="bg-background top-0 sticky">
              <TableRow>
                <TableHead className="w-[200px]">File</TableHead>
                <TableHead className="">Output</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedByAuxName &&
                Object.entries(groupedByAuxName).map(([key, group]) => {
                  // const filePath
                  return (
                    <TableRow key={key}>
                      <TableCell className="break-words">
                        <a
                          href={group.url}
                          target="_blank"
                          className="hover:underline"
                        >
                          {key}
                          <ExternalLink
                            className="inline-block ml-1"
                            size={12}
                          />
                        </a>
                      </TableCell>
                      <TableCell className="flex flex-wrap gap-2">
                        {group.node.map((x) => (
                          <Badge key={x.class_type} variant="outline">
                            {x.class_type}
                          </Badge>
                        ))}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button className="w-fit" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        {/* </div> */}
        {/* <div className="max-h-96 overflow-y-scroll">{view}</div> */}
      </DialogContent>
    </Dialog>
  );
}
