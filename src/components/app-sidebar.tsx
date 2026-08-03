import { Link, useLocation } from "@tanstack/react-router"
import { Boxes, Tag, Upload } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useProducts } from "@/lib/product-store"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const products = useProducts()
  const location = useLocation()
  const activeCategory =
    typeof location.search === "object" && location.search && "category" in location.search
      ? (location.search as { category?: string }).category
      : undefined

  const categories = Array.from(new Set(products.map((p) => p.category))).sort()

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <span className="font-semibold">S</span>
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Sterling Luxe</span>
                  <span className="text-xs text-sidebar-foreground/70">Inventory</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === "/" && !activeCategory}
                >
                  <Link to="/">
                    <Boxes />
                    <span>All Products</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/import_products"}>
                  <Link to="/import_products">
                    <Upload />
                    <span>Import Products</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {categories.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Categories</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {categories.map((category) => (
                  <SidebarMenuItem key={category}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/" && activeCategory === category}
                    >
                      <Link to="/" search={{ category }}>
                        <Tag />
                        <span>{category}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <p className="px-2 py-1 text-xs text-sidebar-foreground/60">
          {products.length} product{products.length === 1 ? "" : "s"} in inventory
        </p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
