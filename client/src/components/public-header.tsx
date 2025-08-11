import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MicaaLogo } from "@/components/micaa-logo";
import { ContactForm } from "@/components/contact-form";
import { Menu, X, Mail } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function PublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      {/* Overlay para cerrar el menú */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden"
          onClick={closeMenu}
        />
      )}
      
      <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm relative">
      <div className="max-w-7xl mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
        <MicaaLogo />
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
          <a href="#materials" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
            Materiales
          </a>
          <a href="#activities" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
            Actividades
          </a>
          <a href="#suppliers" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
            Proveedores
          </a>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Mail className="h-4 w-4 mr-1" />
                <span className="hidden lg:inline">Contacto</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <ContactForm />
            </PopoverContent>
          </Popover>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">
                <span className="hidden lg:inline">Iniciar Sesión</span>
                <span className="lg:hidden">Entrar</span>
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">
                <span className="hidden lg:inline">Registrarse</span>
                <span className="lg:hidden">Registro</span>
              </Link>
            </Button>
          </div>
        </nav>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="p-2">
                <Mail className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <ContactForm />
            </PopoverContent>
          </Popover>
          
          <Button 
            variant="ghost" 
            size="sm"
            className="p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t shadow-lg z-50">
          <div className="px-4 py-4 space-y-4">
            <a 
              href="#materials" 
              className="block text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors py-2"
              onClick={closeMenu}
            >
              📦 Materiales
            </a>
            <a 
              href="#activities" 
              className="block text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors py-2"
              onClick={closeMenu}
            >
              🔧 Actividades
            </a>
            <a 
              href="#suppliers" 
              className="block text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors py-2"
              onClick={closeMenu}
            >
              🏢 Proveedores
            </a>
            
            <div className="pt-4 border-t border-gray-200 space-y-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-center"
                onClick={() => {
                  closeMenu();
                  window.location.href = "/login";
                }}
              >
                Iniciar Sesión
              </Button>
              <Button 
                size="sm" 
                className="w-full justify-center bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  closeMenu();
                  window.location.href = "/register";
                }}
              >
                Registrarse
              </Button>
            </div>
          </div>
        </div>
      )}
      </header>
    </>
  );
}